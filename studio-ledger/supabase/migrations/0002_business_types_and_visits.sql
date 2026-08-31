-- Studio Ledger — business types + visit-based tracking
-- Generalizes the app beyond monthly-membership studios (yoga/gym) to
-- per-visit shops (barbershops/salons): a shop picks a business_type at
-- setup, and visit-based shops track "last visit" instead of monthly fees.

-- ---------------------------------------------------------------------------
-- studios: business type + win-back reminder + public intake settings
-- ---------------------------------------------------------------------------

alter table public.studios
  add column if not exists business_type text not null default 'yoga_studio'
    check (business_type in ('yoga_studio', 'gym', 'barbershop', 'salon', 'other')),
  add column if not exists reminder_days integer not null default 30
    check (reminder_days > 0),
  add column if not exists reminder_message text,
  add column if not exists public_intake_enabled boolean not null default false,
  add column if not exists public_intake_slug text unique;

-- ---------------------------------------------------------------------------
-- visits: one row per service, for visit-based (e.g. barbershop) shops.
-- Mirrors payments' pattern: studio_id is derived server-side from the
-- member, never trusted from the client.
-- ---------------------------------------------------------------------------

create table if not exists public.visits (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.studios (id) on delete cascade,
  member_id uuid not null references public.members (id) on delete cascade,
  visited_on date not null default current_date,
  service text,
  amount numeric(10, 2),
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists visits_studio_id_idx on public.visits (studio_id);
create index if not exists visits_member_id_idx on public.visits (member_id, visited_on desc);

create or replace function public.visits_before_write()
returns trigger
language plpgsql
as $$
begin
  select m.studio_id into new.studio_id
  from public.members m
  where m.id = new.member_id;

  return new;
end;
$$;

drop trigger if exists visits_before_write on public.visits;
create trigger visits_before_write
  before insert or update on public.visits
  for each row
  execute function public.visits_before_write();

alter table public.visits enable row level security;

create policy "studio members can read visits"
  on public.visits for select
  using (studio_id = public.current_studio_id());

create policy "studio members can insert visits"
  on public.visits for insert
  with check (
    studio_id = public.current_studio_id()
    and member_id in (select id from public.members where studio_id = public.current_studio_id())
  );

create policy "studio members can update visits"
  on public.visits for update
  using (studio_id = public.current_studio_id())
  with check (
    studio_id = public.current_studio_id()
    and member_id in (select id from public.members where studio_id = public.current_studio_id())
  );

create policy "studio members can delete visits"
  on public.visits for delete
  using (studio_id = public.current_studio_id());

-- ---------------------------------------------------------------------------
-- create_studio: now also sets business_type. Signature changed (added a
-- parameter), so the old single-argument version is dropped first.
-- ---------------------------------------------------------------------------

drop function if exists public.create_studio(text);

create or replace function public.create_studio(studio_name text, business_type text default 'yoga_studio')
returns public.studios
language plpgsql
security definer
set search_path = public
as $$
declare
  new_studio public.studios;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if exists (select 1 from public.staff_users where id = auth.uid()) then
    raise exception 'This account already belongs to a studio';
  end if;

  insert into public.studios (name, business_type)
  values (nullif(trim(studio_name), ''), business_type)
  returning * into new_studio;

  insert into public.staff_users (id, studio_id, email, role)
  values (auth.uid(), new_studio.id, coalesce(auth.jwt() ->> 'email', ''), 'owner');

  return new_studio;
end;
$$;

-- ---------------------------------------------------------------------------
-- Public self-serve client intake, for a QR code / link at the front desk.
-- Deliberately NOT done via RLS-for-anon on members/visits directly — these
-- two SECURITY DEFINER functions are the only door in, so an anonymous
-- caller can only ever create exactly a name+contact client record (plus a
-- same-day "walk-in" visit) for a studio that has explicitly opted in via
-- public_intake_enabled, and can read nothing beyond a studio's name.
-- ---------------------------------------------------------------------------

create or replace function public.get_intake_studio(intake_slug text)
returns table (name text, business_type text)
language sql
stable
security definer
set search_path = public
as $$
  select s.name, s.business_type
  from public.studios s
  where s.public_intake_slug = intake_slug
    and s.public_intake_enabled = true
$$;

grant execute on function public.get_intake_studio(text) to anon;

create or replace function public.public_intake_add_client(
  intake_slug text,
  client_name text,
  client_phone text default null,
  client_email text default null
)
returns public.members
language plpgsql
security definer
set search_path = public
as $$
declare
  target_studio_id uuid;
  new_member public.members;
begin
  select id into target_studio_id
  from public.studios
  where public_intake_slug = intake_slug
    and public_intake_enabled = true;

  if target_studio_id is null then
    raise exception 'This sign-up link is not active.';
  end if;

  if nullif(trim(client_name), '') is null then
    raise exception 'Name is required.';
  end if;

  insert into public.members (studio_id, name, phone, email, status, monthly_fee)
  values (
    target_studio_id,
    trim(client_name),
    nullif(trim(coalesce(client_phone, '')), ''),
    nullif(trim(coalesce(client_email, '')), ''),
    'active',
    0
  )
  returning * into new_member;

  insert into public.visits (studio_id, member_id, visited_on, service)
  values (target_studio_id, new_member.id, current_date, 'Walk-in sign-up');

  return new_member;
end;
$$;

grant execute on function public.public_intake_add_client(text, text, text, text) to anon;
