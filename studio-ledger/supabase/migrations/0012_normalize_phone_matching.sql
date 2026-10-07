-- Match phone numbers regardless of how they're typed.
--
-- The owner might enter a member's phone as "+91 98109 12636"; the client
-- might type "9810912636" at check-in. Those are the same number, but every
-- phone lookup so far compared the raw strings exactly, so they wouldn't
-- match. This doesn't change what's stored (whatever the owner or client
-- typed stays as-is for display) — only how phones are COMPARED: strip
-- everything but digits, keep the last 10 (an Indian mobile number), and
-- compare that.

create or replace function public.normalize_phone(p text)
returns text
language sql
immutable
set search_path = public
as $$
  select right(regexp_replace(coalesce(p, ''), '\D', '', 'g'), 10)
$$;

-- ---------------------------------------------------------------------------
-- public_check_in: same as the 0010 fix, phone comparison now normalized.
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
  from public.members m
  where m.studio_id = target_studio_id
    and public.normalize_phone(m.phone) = public.normalize_phone(client_phone)
    and m.check_in_pin = trim(pin);

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
-- public_claim_checkin_pin: phone lookup normalized.
-- ---------------------------------------------------------------------------

create or replace function public.public_claim_checkin_pin(
  intake_slug text,
  client_phone text,
  new_pin text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target_studio_id uuid;
  target_member public.members;
begin
  select id into target_studio_id
  from public.studios
  where public_intake_slug = intake_slug
    and public_checkin_enabled = true;

  if target_studio_id is null then
    raise exception 'This check-in link is not active.';
  end if;

  if new_pin !~ '^[0-9]{4,6}$' then
    raise exception 'PIN must be 4-6 digits.';
  end if;

  select * into target_member
  from public.members m
  where m.studio_id = target_studio_id
    and public.normalize_phone(m.phone) = public.normalize_phone(client_phone);

  if target_member.id is null then
    raise exception 'We could not find that phone number. Ask the front desk to add it first.';
  end if;

  if target_member.check_in_pin is not null then
    raise exception 'This phone number already has a PIN set. Ask the front desk to reset it.';
  end if;

  update public.members set check_in_pin = new_pin where id = target_member.id;
end;
$$;

-- ---------------------------------------------------------------------------
-- public_update_profile: same as the 0010 fix, phone comparisons normalized
-- (both the auth lookup and the "already used by another member" check).
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
  from public.members m
  where m.studio_id = target_studio_id
    and public.normalize_phone(m.phone) = public.normalize_phone(client_phone)
    and m.check_in_pin = trim(pin);

  if target_member.id is null then
    raise exception 'We could not find that phone number and PIN. Ask the front desk.';
  end if;

  if cleaned_phone is null then
    raise exception 'Phone number cannot be blank.';
  end if;

  if exists (
    select 1 from public.members m
    where m.studio_id = target_studio_id
      and public.normalize_phone(m.phone) = public.normalize_phone(cleaned_phone)
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
