-- Lets a client update their own basic info from the check-in page, once
-- they're identified by phone+PIN: photo, date of birth, phone, email.
-- Everything else about a member (name, fee, status, batch) stays
-- owner-managed.

alter table public.members
  add column if not exists date_of_birth date;

-- ---------------------------------------------------------------------------
-- member-photos storage: previously staff-only. Now the member themself can
-- also write their own photo, once they know their own member id (handed to
-- them by public_check_in after they prove phone+PIN) — never guessable or
-- enumerable by anyone else, since member listing stays staff-only. Photos
-- live at "<member_id>/photo.<ext>", so folder = member id for both staff
-- and self-serve writes; studio_id is no longer part of the path.
-- ---------------------------------------------------------------------------

drop policy if exists "studio staff can upload member photos" on storage.objects;
drop policy if exists "studio staff can update member photos" on storage.objects;
drop policy if exists "studio staff can delete member photos" on storage.objects;

create policy "staff or the member can upload their own photo"
  on storage.objects for insert
  with check (
    bucket_id = 'member-photos'
    and exists (
      select 1 from public.members m
      where m.id::text = (storage.foldername(name))[1]
        and (auth.role() = 'anon' or m.studio_id = public.current_studio_id())
    )
  );

create policy "staff or the member can update their own photo"
  on storage.objects for update
  using (
    bucket_id = 'member-photos'
    and exists (
      select 1 from public.members m
      where m.id::text = (storage.foldername(name))[1]
        and (auth.role() = 'anon' or m.studio_id = public.current_studio_id())
    )
  )
  with check (
    bucket_id = 'member-photos'
    and exists (
      select 1 from public.members m
      where m.id::text = (storage.foldername(name))[1]
        and (auth.role() = 'anon' or m.studio_id = public.current_studio_id())
    )
  );

create policy "studio staff can delete member photos"
  on storage.objects for delete
  using (
    bucket_id = 'member-photos'
    and exists (
      select 1 from public.members m
      where m.id::text = (storage.foldername(name))[1]
        and m.studio_id = public.current_studio_id()
    )
  );

-- ---------------------------------------------------------------------------
-- public_check_in: also return phone, email and date_of_birth, so the
-- check-in page can pre-fill the client's own "edit my info" form.
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
    batch.duration_minutes,
    target_member.phone,
    target_member.email,
    target_member.date_of_birth;
end;
$$;

grant execute on function public.public_check_in(text, text, text) to anon;

-- ---------------------------------------------------------------------------
-- public_update_profile: the client updates their own phone/email/DOB.
-- Authenticated the same way as check-in (phone+PIN), but logs no visit.
-- Phone can't be blanked (it's their login), and can't collide with another
-- member's phone in the same studio.
-- ---------------------------------------------------------------------------

create or replace function public.public_update_profile(
  intake_slug text,
  client_phone text,
  pin text,
  new_phone text,
  new_email text,
  new_date_of_birth date,
  new_photo_url text default null
)
returns table (
  member_id uuid,
  phone text,
  email text,
  date_of_birth date,
  photo_url text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  target_studio_id uuid;
  target_member public.members;
  cleaned_phone text := nullif(trim(coalesce(new_phone, '')), '');
  cleaned_email text := nullif(trim(coalesce(new_email, '')), '');
  cleaned_photo_url text := nullif(trim(coalesce(new_photo_url, '')), '');
begin
  select id into target_studio_id
  from public.studios
  where public_intake_slug = intake_slug
    and public_checkin_enabled = true;

  if target_studio_id is null then
    raise exception 'This check-in link is not active.';
  end if;

  select * into target_member
  from public.members
  where studio_id = target_studio_id
    and phone = trim(client_phone)
    and check_in_pin = trim(pin);

  if target_member.id is null then
    raise exception 'We could not find that phone number and PIN. Ask the front desk.';
  end if;

  if cleaned_phone is null then
    raise exception 'Phone number cannot be blank.';
  end if;

  if exists (
    select 1 from public.members m
    where m.studio_id = target_studio_id
      and m.phone = cleaned_phone
      and m.id <> target_member.id
  ) then
    raise exception 'That phone number is already used by another member. Ask the front desk.';
  end if;

  update public.members
  set phone = cleaned_phone,
      email = cleaned_email,
      date_of_birth = new_date_of_birth,
      photo_url = coalesce(cleaned_photo_url, target_member.photo_url)
  where id = target_member.id;

  return query
  select target_member.id, cleaned_phone, cleaned_email, new_date_of_birth,
    coalesce(cleaned_photo_url, target_member.photo_url);
end;
$$;

grant execute on function public.public_update_profile(text, text, text, text, text, date, text) to anon;
