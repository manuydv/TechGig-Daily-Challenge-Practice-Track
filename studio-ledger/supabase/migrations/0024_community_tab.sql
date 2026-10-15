-- Member portal "Community" tab: a photo slideshow, two owner-set
-- spotlights (e.g. "Student of the Month", "Most Consistent" — both
-- manually chosen by the owner, no auto-computation), a pinned
-- announcement, and automatic birthday shout-outs for the current month.
-- Also adds a lifetime visit count to public_check_in, for a milestone
-- badge ("50 classes completed!") on the member's own account tab.

alter table public.studios
  add column if not exists announcement_text text,
  add column if not exists spotlight_1_title text,
  add column if not exists spotlight_1_name text,
  add column if not exists spotlight_1_photo_url text,
  add column if not exists spotlight_2_title text,
  add column if not exists spotlight_2_name text,
  add column if not exists spotlight_2_photo_url text;

create table if not exists public.gallery_photos (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.studios (id) on delete cascade,
  photo_url text not null,
  created_at timestamptz not null default now()
);

create index if not exists gallery_photos_studio_idx on public.gallery_photos (studio_id, created_at desc);

alter table public.gallery_photos enable row level security;

create policy "studio staff can read gallery_photos"
  on public.gallery_photos for select
  using (studio_id = public.current_studio_id());

create policy "studio staff can insert gallery_photos"
  on public.gallery_photos for insert
  with check (studio_id = public.current_studio_id());

create policy "studio staff can delete gallery_photos"
  on public.gallery_photos for delete
  using (studio_id = public.current_studio_id());

-- ---------------------------------------------------------------------------
-- Storage: a public bucket for gallery + spotlight photos, staff-only
-- upload, scoped by "<studio_id>/..." path prefix (same pattern as
-- member-photos / payment-qr).
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('studio-gallery', 'studio-gallery', true)
on conflict (id) do nothing;

create policy "studio gallery photos are publicly readable"
  on storage.objects for select
  using (bucket_id = 'studio-gallery');

create policy "studio staff can upload studio gallery photos"
  on storage.objects for insert
  with check (
    bucket_id = 'studio-gallery'
    and (storage.foldername(name))[1] = public.current_studio_id()::text
  );

create policy "studio staff can update studio gallery photos"
  on storage.objects for update
  using (
    bucket_id = 'studio-gallery'
    and (storage.foldername(name))[1] = public.current_studio_id()::text
  )
  with check (
    bucket_id = 'studio-gallery'
    and (storage.foldername(name))[1] = public.current_studio_id()::text
  );

create policy "studio staff can delete studio gallery photos"
  on storage.objects for delete
  using (
    bucket_id = 'studio-gallery'
    and (storage.foldername(name))[1] = public.current_studio_id()::text
  );

-- ---------------------------------------------------------------------------
-- public_checkin_community: everything the Community tab needs in one
-- call. Same phone+PIN re-auth as every other member-portal RPC.
-- ---------------------------------------------------------------------------

create or replace function public.public_checkin_community(
  intake_slug text,
  client_phone text,
  pin text
)
returns table (
  announcement_text text,
  spotlight_1_title text,
  spotlight_1_name text,
  spotlight_1_photo_url text,
  spotlight_2_title text,
  spotlight_2_name text,
  spotlight_2_photo_url text,
  gallery_photo_urls text[],
  birthday_names text[],
  birthday_days integer[]
)
language plpgsql
security definer
set search_path = public
as $$
declare
  target_studio_id uuid;
  target_member public.members;
  target_studio public.studios;
  phone_key text := public.normalize_phone(client_phone);
begin
  select id into target_studio_id
  from public.studios
  where public_intake_slug = intake_slug
    and public_checkin_enabled = true;

  if target_studio_id is null then
    raise exception 'This link is not active.';
  end if;

  perform public.assert_not_locked_out(target_studio_id, phone_key);

  select * into target_member
  from public.members m
  where m.studio_id = target_studio_id
    and public.normalize_phone(m.phone) = phone_key
    and (
      (m.check_in_pin is not null and m.check_in_pin = trim(pin))
      or trim(pin) = right(phone_key, 4)
    );

  if target_member.id is null then
    perform public.record_checkin_attempt(target_studio_id, phone_key, false, 'checkin');
    raise exception 'We could not find that phone number and PIN. Ask the front desk.';
  end if;

  perform public.record_checkin_attempt(target_studio_id, phone_key, true, 'checkin', target_member.id);

  select * into target_studio from public.studios where id = target_studio_id;

  return query
  select
    target_studio.announcement_text,
    target_studio.spotlight_1_title,
    target_studio.spotlight_1_name,
    target_studio.spotlight_1_photo_url,
    target_studio.spotlight_2_title,
    target_studio.spotlight_2_name,
    target_studio.spotlight_2_photo_url,
    array(
      select g.photo_url
      from public.gallery_photos g
      where g.studio_id = target_studio_id
      order by g.created_at desc
    ),
    array(
      select m.name
      from public.members m
      where m.studio_id = target_studio_id
        and m.date_of_birth is not null
        and extract(month from m.date_of_birth) = extract(month from current_date)
      order by extract(day from m.date_of_birth)
    ),
    array(
      select extract(day from m.date_of_birth)::integer
      from public.members m
      where m.studio_id = target_studio_id
        and m.date_of_birth is not null
        and extract(month from m.date_of_birth) = extract(month from current_date)
      order by extract(day from m.date_of_birth)
    );
end;
$$;

grant execute on function public.public_checkin_community(text, text, text) to anon;

-- ---------------------------------------------------------------------------
-- public_check_in: also return a lifetime visit count, for the "N classes
-- completed" milestone badge on the account tab. recent_visits is capped
-- to the last 70 days, so it can't be used for this. The return columns
-- are changing shape, which create or replace can't do on its own —
-- drop first.
-- ---------------------------------------------------------------------------

drop function if exists public.public_check_in(text, text, text);

create or replace function public.public_check_in(
  intake_slug text,
  client_phone text,
  pin text
)
returns table (
  member_id uuid,
  member_name text,
  visited_on date,
  recent_visits date[],
  total_visits bigint,
  monthly_fee numeric,
  member_status text,
  this_month_paid boolean,
  photo_url text,
  gender text,
  batch_name text,
  batch_instructor_name text,
  batch_days_of_week integer[],
  batch_start_time time,
  batch_duration_minutes integer,
  phone text,
  email text,
  date_of_birth date
)
language plpgsql
security definer
set search_path = public
as $$
declare
  target_studio_id uuid;
  target_member public.members;
  today date := current_date;
  this_month text := to_char(current_date, 'YYYY-MM');
  paid_this_month boolean;
  batch public.classes;
  phone_key text := public.normalize_phone(client_phone);
begin
  select id into target_studio_id
  from public.studios
  where public_intake_slug = intake_slug
    and public_checkin_enabled = true;

  if target_studio_id is null then
    raise exception 'This check-in link is not active.';
  end if;

  if nullif(trim(coalesce(client_phone, '')), '') is null
    or nullif(trim(coalesce(pin, '')), '') is null then
    raise exception 'Enter your phone number and PIN.';
  end if;

  perform public.assert_not_locked_out(target_studio_id, phone_key);

  select * into target_member
  from public.members m
  where m.studio_id = target_studio_id
    and public.normalize_phone(m.phone) = phone_key
    and (
      (m.check_in_pin is not null and m.check_in_pin = trim(pin))
      or trim(pin) = right(phone_key, 4)
    );

  if target_member.id is null then
    perform public.record_checkin_attempt(target_studio_id, phone_key, false, 'checkin');
    raise exception 'We could not find that phone number and PIN. Ask the front desk.';
  end if;

  perform public.record_checkin_attempt(target_studio_id, phone_key, true, 'checkin', target_member.id);

  select p.paid into paid_this_month
  from public.payments p
  where p.member_id = target_member.id
    and p.month = this_month;

  if target_member.class_id is not null then
    select * into batch from public.classes where id = target_member.class_id;
  end if;

  return query
  select
    target_member.id,
    target_member.name,
    today,
    array(
      select distinct v.visited_on
      from public.visits v
      where v.member_id = target_member.id
        and v.visited_on >= today - 70
      order by v.visited_on desc
    ),
    (select count(*) from public.visits v2 where v2.member_id = target_member.id),
    target_member.monthly_fee,
    target_member.status,
    coalesce(paid_this_month, false),
    target_member.photo_url,
    target_member.gender,
    batch.name,
    batch.instructor_name,
    batch.days_of_week,
    batch.start_time,
    batch.duration_minutes,
    target_member.phone,
    target_member.email,
    target_member.date_of_birth;
end;
$$;

grant execute on function public.public_check_in(text, text, text) to anon;
