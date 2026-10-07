-- Studio Ledger — client self check-in
-- A client can check themselves in on a shared "kiosk" device (a phone or
-- tablet at the front desk) by entering their phone number and a short PIN,
-- without needing an account or the app installed. Reuses the same
-- public_intake_slug a studio already has for the self-serve sign-up link —
-- one QR code at the front desk covers both "new here" and "checking in".

alter table public.members
  add column if not exists check_in_pin text
    check (check_in_pin is null or check_in_pin ~ '^[0-9]{4,6}$');

-- Separate from public_intake_enabled: a membership studio (yoga/gym) may
-- want attendance check-in without ever turning on public self-serve
-- sign-up, and a studio that later turns off sign-up shouldn't also lock
-- out existing clients checking in.
alter table public.studios
  add column if not exists public_checkin_enabled boolean not null default false;

-- ---------------------------------------------------------------------------
-- get_checkin_studio: same shape as get_intake_studio, gated on its own flag.
-- ---------------------------------------------------------------------------

create or replace function public.get_checkin_studio(intake_slug text)
returns table (name text, business_type text)
language sql
stable
security definer
set search_path = public
as $$
  select s.name, s.business_type
  from public.studios s
  where s.public_intake_slug = intake_slug
    and s.public_checkin_enabled = true
$$;

grant execute on function public.get_checkin_studio(text) to anon;

-- ---------------------------------------------------------------------------
-- public_check_in: looks up a member by phone + PIN within the studio the
-- slug belongs to, logs a visit, and hands back enough recent visit history
-- for the client to show a streak/attendance summary. Deliberately returns
-- no financial or contact data beyond the member's own name.
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
  recent_visits date[]
)
language plpgsql
security definer
set search_path = public
as $$
declare
  target_studio_id uuid;
  target_member public.members;
  today date := current_date;
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
    );
end;
$$;

grant execute on function public.public_check_in(text, text, text) to anon;
