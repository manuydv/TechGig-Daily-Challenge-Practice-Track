-- Studio Ledger — class schedule + client self-service additions
-- Adds a class schedule (owner-managed, publicly viewable alongside
-- check-in), lets a client claim their own check-in PIN on first use, and
-- extends the check-in response with the client's own membership status.

-- ---------------------------------------------------------------------------
-- classes: a studio's recurring class schedule. Not tied to individual
-- members/enrollment (no "my batch" concept yet) — just the shop's schedule,
-- shown to any client who checks in.
-- ---------------------------------------------------------------------------

create table if not exists public.classes (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.studios (id) on delete cascade,
  name text not null,
  instructor_name text,
  days_of_week integer[] not null default '{}',  -- 0 = Sunday .. 6 = Saturday
  start_time time not null,
  duration_minutes integer not null default 60 check (duration_minutes > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists classes_studio_id_idx on public.classes (studio_id);

drop trigger if exists classes_set_updated_at on public.classes;
create trigger classes_set_updated_at
  before update on public.classes
  for each row
  execute function public.set_updated_at();

alter table public.classes enable row level security;

create policy "studio members can read classes"
  on public.classes for select
  using (studio_id = public.current_studio_id());

create policy "studio members can insert classes"
  on public.classes for insert
  with check (studio_id = public.current_studio_id());

create policy "studio members can update classes"
  on public.classes for update
  using (studio_id = public.current_studio_id())
  with check (studio_id = public.current_studio_id());

create policy "studio members can delete classes"
  on public.classes for delete
  using (studio_id = public.current_studio_id());

-- ---------------------------------------------------------------------------
-- get_checkin_schedule: the studio's class schedule, for the public
-- check-in page. Same trust model as get_checkin_studio (gated on
-- public_checkin_enabled, no auth needed).
-- ---------------------------------------------------------------------------

create or replace function public.get_checkin_schedule(intake_slug text)
returns table (
  name text,
  instructor_name text,
  days_of_week integer[],
  start_time time,
  duration_minutes integer
)
language sql
stable
security definer
set search_path = public
as $$
  select c.name, c.instructor_name, c.days_of_week, c.start_time, c.duration_minutes
  from public.classes c
  join public.studios s on s.id = c.studio_id
  where s.public_intake_slug = intake_slug
    and s.public_checkin_enabled = true
  order by c.start_time
$$;

grant execute on function public.get_checkin_schedule(text) to anon;

-- ---------------------------------------------------------------------------
-- public_claim_checkin_pin: lets a client set their OWN check-in PIN the
-- first time, without staff doing it for them — only when the phone number
-- is already on file (staff-entered) and has no PIN yet. Never overwrites an
-- existing PIN; that still requires asking the front desk, same as before.
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
  from public.members
  where studio_id = target_studio_id
    and phone = trim(client_phone);

  if target_member.id is null then
    raise exception 'We could not find that phone number. Ask the front desk to add it first.';
  end if;

  if target_member.check_in_pin is not null then
    raise exception 'This phone number already has a PIN set. Ask the front desk to reset it.';
  end if;

  update public.members set check_in_pin = new_pin where id = target_member.id;
end;
$$;

grant execute on function public.public_claim_checkin_pin(text, text, text) to anon;

-- ---------------------------------------------------------------------------
-- public_check_in: extended to also return the client's own membership
-- status (fee, status, whether this month is paid) so the check-in page can
-- show a status card, not just streak stats. Return type changed, so the
-- old function is dropped first.
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
  this_month_paid boolean
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
    coalesce(paid_this_month, false);
end;
$$;

grant execute on function public.public_check_in(text, text, text) to anon;
