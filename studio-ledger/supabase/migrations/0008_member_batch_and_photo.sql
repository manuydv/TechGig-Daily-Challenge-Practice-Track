-- Member batch assignment + profile photo.
--
-- Lets the owner assign a member to one of the studio's classes ("My
-- batch" on the client's check-in page) and upload a profile photo for
-- them. Batch assignment is single-select (one class per member) — pick
-- the batch from the member's edit screen with a single tap.

alter table public.members
  add column if not exists class_id uuid references public.classes (id) on delete set null,
  add column if not exists photo_url text;

create index if not exists members_class_id_idx on public.members (class_id);

-- ---------------------------------------------------------------------------
-- Storage: a public bucket for member photos, uploaded by studio staff only
-- (owner-managed, same as every other member detail). Objects are stored at
-- "<studio_id>/<member_id>.<ext>" so the first path segment can be checked
-- against current_studio_id() without a lookup.
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('member-photos', 'member-photos', true)
on conflict (id) do nothing;

drop policy if exists "member photos are publicly readable" on storage.objects;
create policy "member photos are publicly readable"
  on storage.objects for select
  using (bucket_id = 'member-photos');

drop policy if exists "studio staff can upload member photos" on storage.objects;
create policy "studio staff can upload member photos"
  on storage.objects for insert
  with check (
    bucket_id = 'member-photos'
    and (storage.foldername(name))[1] = public.current_studio_id()::text
  );

drop policy if exists "studio staff can update member photos" on storage.objects;
create policy "studio staff can update member photos"
  on storage.objects for update
  using (
    bucket_id = 'member-photos'
    and (storage.foldername(name))[1] = public.current_studio_id()::text
  )
  with check (
    bucket_id = 'member-photos'
    and (storage.foldername(name))[1] = public.current_studio_id()::text
  );

drop policy if exists "studio staff can delete member photos" on storage.objects;
create policy "studio staff can delete member photos"
  on storage.objects for delete
  using (
    bucket_id = 'member-photos'
    and (storage.foldername(name))[1] = public.current_studio_id()::text
  );

-- ---------------------------------------------------------------------------
-- public_check_in: extended to also return the member's photo and their
-- assigned batch (if any), so the check-in result page can show "My batch"
-- instead of the studio's full schedule.
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
  monthly_fee numeric,
  member_status text,
  this_month_paid boolean,
  photo_url text,
  batch_name text,
  batch_instructor_name text,
  batch_days_of_week integer[],
  batch_start_time time,
  batch_duration_minutes integer
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

  select * into target_member
  from public.members
  where studio_id = target_studio_id
    and phone = trim(client_phone)
    and check_in_pin = trim(pin);

  if target_member.id is null then
    raise exception 'We could not find that phone number and PIN. Ask the front desk.';
  end if;

  insert into public.visits (studio_id, member_id, visited_on, notes)
  values (target_studio_id, target_member.id, today, 'Self check-in');

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
    target_member.monthly_fee,
    target_member.status,
    coalesce(paid_this_month, false),
    target_member.photo_url,
    batch.name,
    batch.instructor_name,
    batch.days_of_week,
    batch.start_time,
    batch.duration_minutes;
end;
$$;

grant execute on function public.public_check_in(text, text, text) to anon;
