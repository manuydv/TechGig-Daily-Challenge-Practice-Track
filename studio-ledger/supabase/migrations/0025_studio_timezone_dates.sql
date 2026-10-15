-- Fix: "Mark today's attendance" reappearing after a fresh login.
--
-- Every check-in/attendance function computed "today" from current_date,
-- which runs in the database session's timezone (UTC on Supabase) — not
-- the studio's own timezone (studios.timezone, 'Asia/Kolkata' by
-- default). Between 12:00 AM and 5:29 AM IST, UTC's calendar date is
-- still the previous day, so a visit self-marked in that window saved
-- under yesterday's date while the app checked for today's IST date and
-- found nothing — showing the button again on every fresh login.
--
-- Fix: compute "today" from the studio's own timezone everywhere a
-- calendar day boundary matters. None of these functions' return shapes
-- change, so no drop is needed first.

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
  studio_today date;
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
    perform public.record_checkin_attempt(target_studio_id, phone_key, false, 'self_attendance');
    raise exception 'We could not find that phone number and PIN. Ask the front desk.';
  end if;

  perform public.record_checkin_attempt(target_studio_id, phone_key, true, 'self_attendance', target_member.id);

  select (now() at time zone coalesce(s.timezone, 'Asia/Kolkata'))::date into studio_today
  from public.studios s where s.id = target_studio_id;

  insert into public.visits (studio_id, member_id, visited_on, notes)
  values (target_studio_id, target_member.id, studio_today, 'Self check-in')
  on conflict (member_id, visited_on) do nothing;
end;
$$;

grant execute on function public.public_mark_self_attendance(text, text, text) to anon;

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
  today date;
  this_month text;
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

  select (now() at time zone coalesce(s.timezone, 'Asia/Kolkata'))::date into today
  from public.studios s where s.id = target_studio_id;
  this_month := to_char(today, 'YYYY-MM');

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

create or replace function public.public_trainer_toggle_attendance(
  intake_slug text,
  phone text,
  pin text,
  target_member_id uuid,
  for_date date,
  present boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  emp public.employees;
  target_member public.members;
  studio_today date;
begin
  emp := public.trainer_authenticate(intake_slug, phone, pin);

  select (now() at time zone coalesce(s.timezone, 'Asia/Kolkata'))::date into studio_today
  from public.studios s where s.id = emp.studio_id;

  if for_date > studio_today then
    raise exception 'Cannot mark attendance for a future date.';
  end if;

  select * into target_member
  from public.members
  where id = target_member_id and studio_id = emp.studio_id;

  if target_member.id is null then
    raise exception 'Member not found.';
  end if;

  if present then
    insert into public.visits (studio_id, member_id, visited_on, notes)
    values (emp.studio_id, target_member.id, for_date, 'Marked by ' || emp.name)
    on conflict (member_id, visited_on) do nothing;
  else
    delete from public.visits where member_id = target_member.id and visited_on = for_date;
  end if;
end;
$$;

grant execute on function public.public_trainer_toggle_attendance(text, text, text, uuid, date, boolean) to anon;

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
  studio_today date;
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
  studio_today := (now() at time zone coalesce(target_studio.timezone, 'Asia/Kolkata'))::date;

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
        and extract(month from m.date_of_birth) = extract(month from studio_today)
      order by extract(day from m.date_of_birth)
    ),
    array(
      select extract(day from m.date_of_birth)::integer
      from public.members m
      where m.studio_id = target_studio_id
        and m.date_of_birth is not null
        and extract(month from m.date_of_birth) = extract(month from studio_today)
      order by extract(day from m.date_of_birth)
    );
end;
$$;

grant execute on function public.public_checkin_community(text, text, text) to anon;
