-- Two changes to the client account page:
--
-- 1. A member can log in with their custom PIN (if they've set one) OR the
--    last 4 digits of their own phone number — no need to wait for the
--    front desk to hand out a PIN. Setting a custom PIN still works and is
--    just an extra accepted credential, not a replacement.
--
-- 2. Self check-in is back, but scoped tightly: a button on the account
--    page lets a member mark themselves present for TODAY only (server
--    picks the date, never client-supplied). Marking any other day is
--    still owner-only, from the Check-in tab.

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
    perform public.record_checkin_attempt(target_studio_id, phone_key, false);
    raise exception 'We could not find that phone number and PIN. Ask the front desk.';
  end if;

  perform public.record_checkin_attempt(target_studio_id, phone_key, true);

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
  phone_key text := public.normalize_phone(client_phone);
begin
  select id into target_studio_id
  from public.studios
  where public_intake_slug = intake_slug
    and public_checkin_enabled = true;

  if target_studio_id is null then
    raise exception 'This check-in link is not active.';
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
    perform public.record_checkin_attempt(target_studio_id, phone_key, false);
    raise exception 'We could not find that phone number and PIN. Ask the front desk.';
  end if;

  perform public.record_checkin_attempt(target_studio_id, phone_key, true);

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

-- ---------------------------------------------------------------------------
-- public_mark_self_attendance: a member marks themselves present TODAY.
-- Same phone+PIN auth (custom PIN or last-4-digits fallback) as everything
-- else on the account page. Upserts so it's a no-op if already marked
-- (by the member or by staff) rather than erroring on the unique
-- constraint.
-- ---------------------------------------------------------------------------

create or replace function public.public_mark_self_attendance(
  intake_slug text,
  client_phone text,
  pin text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target_studio_id uuid;
  target_member public.members;
  phone_key text := public.normalize_phone(client_phone);
begin
  select id into target_studio_id
  from public.studios
  where public_intake_slug = intake_slug
    and public_checkin_enabled = true;

  if target_studio_id is null then
    raise exception 'This check-in link is not active.';
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
    perform public.record_checkin_attempt(target_studio_id, phone_key, false);
    raise exception 'We could not find that phone number and PIN. Ask the front desk.';
  end if;

  perform public.record_checkin_attempt(target_studio_id, phone_key, true);

  insert into public.visits (studio_id, member_id, visited_on, notes)
  values (target_studio_id, target_member.id, current_date, 'Self check-in')
  on conflict (member_id, visited_on) do nothing;
end;
$$;

grant execute on function public.public_mark_self_attendance(text, text, text) to anon;
