-- Rate-limit the public, unauthenticated phone+PIN endpoints.
--
-- public_check_in, public_claim_checkin_pin, and public_update_profile are
-- all callable by anyone (anon) with just a phone number + PIN, no login.
-- A PIN is 4-6 digits — as few as ~9,000 possible values — and until now
-- nothing stopped an attacker from trying every combination for a known or
-- guessed phone number. This adds a simple lockout: too many failed
-- attempts for a given phone number within a short window, and further
-- attempts are refused for a while, regardless of whether the PIN is right.
--
-- Also fixes a smaller leak in public_claim_checkin_pin: it used to return
-- a different error for "no member with that phone" vs. "that member
-- already has a PIN", which let someone probe which phone numbers are
-- registered. Both cases now return the same generic message.

create table if not exists public.checkin_attempts (
  id bigint generated always as identity primary key,
  studio_id uuid not null references public.studios (id) on delete cascade,
  phone_key text not null,
  success boolean not null,
  attempted_at timestamptz not null default now()
);

create index if not exists checkin_attempts_lookup_idx
  on public.checkin_attempts (studio_id, phone_key, attempted_at desc);

-- No policies: deny-all by default. Only the SECURITY DEFINER functions
-- below ever touch this table; it's never exposed to anon directly.
alter table public.checkin_attempts enable row level security;

create or replace function public.assert_not_locked_out(p_studio_id uuid, p_phone_key text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  recent_failures integer;
begin
  select count(*) into recent_failures
  from public.checkin_attempts
  where studio_id = p_studio_id
    and phone_key = p_phone_key
    and success = false
    and attempted_at > now() - interval '15 minutes';

  if recent_failures >= 10 then
    raise exception 'Too many attempts for this phone number. Try again in 15 minutes, or ask the front desk.';
  end if;
end;
$$;

create or replace function public.record_checkin_attempt(p_studio_id uuid, p_phone_key text, p_success boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.checkin_attempts (studio_id, phone_key, success)
  values (p_studio_id, p_phone_key, p_success);

  -- Opportunistic cleanup, keeps the table from growing unbounded without
  -- needing a cron job — cheap at this table's scale (one studio's traffic).
  delete from public.checkin_attempts where attempted_at < now() - interval '1 day';
end;
$$;

-- ---------------------------------------------------------------------------
-- public_check_in: lockout check before the lookup; record every outcome.
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
    and m.check_in_pin = trim(pin);

  if target_member.id is null then
    perform public.record_checkin_attempt(target_studio_id, phone_key, false);
    raise exception 'We could not find that phone number and PIN. Ask the front desk.';
  end if;

  perform public.record_checkin_attempt(target_studio_id, phone_key, true);

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
-- public_claim_checkin_pin: lockout check, and the two failure cases now
-- share one generic message instead of leaking which phone numbers exist.
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
    perform public.record_checkin_attempt(target_studio_id, phone_key, false);
    raise exception 'We could not set that PIN for this phone number. Ask the front desk for help.';
  end if;

  perform public.record_checkin_attempt(target_studio_id, phone_key, true);

  update public.members set check_in_pin = new_pin where id = target_member.id;
end;
$$;

-- ---------------------------------------------------------------------------
-- public_update_profile: same lockout treatment.
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
    and m.check_in_pin = trim(pin);

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
