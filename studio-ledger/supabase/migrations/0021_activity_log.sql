-- Owner-facing activity log for the member/trainer portal.
--
-- checkin_attempts already recorded every phone+PIN attempt (success or
-- failure) for rate-limiting, but purged anything older than a day and
-- was never readable by the owner (deny-all RLS). This turns it into a
-- real log: adds an action type + who it was (once identified), keeps
-- history for 180 days instead of 1, and opens it up to studio staff.

alter table public.checkin_attempts
  add column if not exists action text not null default 'checkin'
    check (action in ('checkin', 'claim_pin', 'update_profile', 'self_attendance', 'trainer_login')),
  add column if not exists member_id uuid references public.members (id) on delete set null,
  add column if not exists employee_id uuid references public.employees (id) on delete set null;

create index if not exists checkin_attempts_studio_recent_idx
  on public.checkin_attempts (studio_id, attempted_at desc);

create policy "studio staff can read checkin_attempts"
  on public.checkin_attempts for select
  using (studio_id = public.current_studio_id());

create or replace function public.record_checkin_attempt(
  p_studio_id uuid,
  p_phone_key text,
  p_success boolean,
  p_action text default 'checkin',
  p_member_id uuid default null,
  p_employee_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.checkin_attempts (studio_id, phone_key, success, action, member_id, employee_id)
  values (p_studio_id, p_phone_key, p_success, p_action, p_member_id, p_employee_id);

  -- Opportunistic cleanup, same reasoning as before, just a much longer
  -- window now that this doubles as a log instead of only rate-limit state.
  delete from public.checkin_attempts where attempted_at < now() - interval '180 days';
end;
$$;

-- ---------------------------------------------------------------------------
-- Every phone+PIN RPC now tags its attempts with an action and, once the
-- member/employee is identified, their id. Auth logic is unchanged.
-- ---------------------------------------------------------------------------

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
  phone_key text := public.normalize_phone(client_phone);
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

  perform public.assert_not_locked_out(target_studio_id, phone_key);

  select * into target_member
  from public.members m
  where m.studio_id = target_studio_id
    and public.normalize_phone(m.phone) = phone_key;

  if target_member.id is null or target_member.check_in_pin is not null then
    perform public.record_checkin_attempt(target_studio_id, phone_key, false, 'claim_pin', target_member.id);
    raise exception 'We could not set that PIN for this phone number. Ask the front desk for help.';
  end if;

  perform public.record_checkin_attempt(target_studio_id, phone_key, true, 'claim_pin', target_member.id);

  update public.members set check_in_pin = new_pin where id = target_member.id;
end;
$$;

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
    perform public.record_checkin_attempt(target_studio_id, phone_key, false, 'update_profile');
    raise exception 'We could not find that phone number and PIN. Ask the front desk.';
  end if;

  perform public.record_checkin_attempt(target_studio_id, phone_key, true, 'update_profile', target_member.id);

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
    perform public.record_checkin_attempt(target_studio_id, phone_key, false, 'self_attendance');
    raise exception 'We could not find that phone number and PIN. Ask the front desk.';
  end if;

  perform public.record_checkin_attempt(target_studio_id, phone_key, true, 'self_attendance', target_member.id);

  insert into public.visits (studio_id, member_id, visited_on, notes)
  values (target_studio_id, target_member.id, current_date, 'Self check-in')
  on conflict (member_id, visited_on) do nothing;
end;
$$;

grant execute on function public.public_mark_self_attendance(text, text, text) to anon;

create or replace function public.trainer_authenticate(
  intake_slug text,
  phone text,
  pin text
)
returns public.employees
language plpgsql
security definer
set search_path = public
as $$
declare
  target_studio_id uuid;
  target_employee public.employees;
  phone_key text := public.normalize_phone(phone);
begin
  select id into target_studio_id
  from public.studios
  where public_intake_slug = intake_slug
    and public_checkin_enabled = true;

  if target_studio_id is null then
    raise exception 'This link is not active.';
  end if;

  if nullif(trim(coalesce(phone, '')), '') is null
    or nullif(trim(coalesce(pin, '')), '') is null then
    raise exception 'Enter your phone number and PIN.';
  end if;

  perform public.assert_not_locked_out(target_studio_id, phone_key);

  select * into target_employee
  from public.employees e
  where e.studio_id = target_studio_id
    and public.normalize_phone(e.phone) = phone_key
    and e.check_in_pin is not null
    and e.check_in_pin = trim(pin);

  if target_employee.id is null then
    perform public.record_checkin_attempt(target_studio_id, phone_key, false, 'trainer_login');
    raise exception 'We could not find that phone number and PIN. Ask the studio owner.';
  end if;

  perform public.record_checkin_attempt(target_studio_id, phone_key, true, 'trainer_login', null, target_employee.id);

  return target_employee;
end;
$$;
