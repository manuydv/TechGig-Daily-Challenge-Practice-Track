-- Studio Ledger — Phase 1 schema
-- Single-studio-per-owner, multi-tenant-ready via studio_id + RLS.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table if not exists public.studios (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  logo_url text,
  currency text not null default 'INR',
  timezone text not null default 'Asia/Kolkata',
  subscription_status text not null default 'trialing',
  created_at timestamptz not null default now()
);

-- One row per authenticated user; id IS the auth.users id, which is what
-- lets RLS map "who is logged in" to "which studio do they belong to".
create table if not exists public.staff_users (
  id uuid primary key references auth.users (id) on delete cascade,
  studio_id uuid not null references public.studios (id) on delete cascade,
  email text not null,
  role text not null default 'owner' check (role in ('owner', 'staff')),
  created_at timestamptz not null default now()
);

create index if not exists staff_users_studio_id_idx on public.staff_users (studio_id);

create table if not exists public.members (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.studios (id) on delete cascade,
  name text not null,
  gender text check (gender in ('male', 'female', 'other')),
  phone text,
  email text,
  joined_on date not null default current_date,
  monthly_fee numeric(10, 2) not null default 0 check (monthly_fee >= 0),
  status text not null default 'active' check (status in ('active', 'paused', 'inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists members_studio_id_idx on public.members (studio_id);
create index if not exists members_studio_status_idx on public.members (studio_id, status);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.studios (id) on delete cascade,
  member_id uuid not null references public.members (id) on delete cascade,
  month text not null check (month ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  amount numeric(10, 2),
  paid boolean not null default false,
  paid_on date,
  created_at timestamptz not null default now(),
  unique (member_id, month)
);

create index if not exists payments_studio_id_idx on public.payments (studio_id);
create index if not exists payments_member_id_idx on public.payments (member_id);

-- ---------------------------------------------------------------------------
-- Helper triggers
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists members_set_updated_at on public.members;
create trigger members_set_updated_at
  before update on public.members
  for each row
  execute function public.set_updated_at();

-- Always derive a payment's studio_id from its member server-side, so a
-- client can never write a payment into a studio it doesn't own by lying
-- about studio_id. Also stamp paid_on when a payment is (un)marked paid.
create or replace function public.payments_before_write()
returns trigger
language plpgsql
as $$
begin
  select m.studio_id into new.studio_id
  from public.members m
  where m.id = new.member_id;

  if new.paid and new.paid_on is null then
    new.paid_on = current_date;
  elsif not new.paid then
    new.paid_on = null;
  end if;

  return new;
end;
$$;

drop trigger if exists payments_before_write on public.payments;
create trigger payments_before_write
  before insert or update on public.payments
  for each row
  execute function public.payments_before_write();

-- ---------------------------------------------------------------------------
-- RLS helper: the studio_id of the currently authenticated user.
-- SECURITY DEFINER + a fixed search_path lets this read staff_users without
-- re-triggering staff_users' own RLS policies (which would recurse).
-- ---------------------------------------------------------------------------

create or replace function public.current_studio_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select studio_id from public.staff_users where id = auth.uid()
$$;

-- ---------------------------------------------------------------------------
-- Onboarding RPC: atomically create a studio and make the caller its owner.
-- Bypasses table RLS (SECURITY DEFINER) so the client never needs direct
-- insert access to studios/staff_users.
-- ---------------------------------------------------------------------------

create or replace function public.create_studio(studio_name text)
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

  insert into public.studios (name)
  values (nullif(trim(studio_name), ''))
  returning * into new_studio;

  insert into public.staff_users (id, studio_id, email, role)
  values (auth.uid(), new_studio.id, coalesce(auth.jwt() ->> 'email', ''), 'owner');

  return new_studio;
end;
$$;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.studios enable row level security;
alter table public.staff_users enable row level security;
alter table public.members enable row level security;
alter table public.payments enable row level security;

create policy "studio members can read their studio"
  on public.studios for select
  using (id = public.current_studio_id());

create policy "studio owner can update their studio"
  on public.studios for update
  using (id = public.current_studio_id())
  with check (id = public.current_studio_id());

create policy "a user can read their own staff row"
  on public.staff_users for select
  using (id = auth.uid());

create policy "studio members can read members"
  on public.members for select
  using (studio_id = public.current_studio_id());

create policy "studio members can insert members"
  on public.members for insert
  with check (studio_id = public.current_studio_id());

create policy "studio members can update members"
  on public.members for update
  using (studio_id = public.current_studio_id())
  with check (studio_id = public.current_studio_id());

create policy "studio members can delete members"
  on public.members for delete
  using (studio_id = public.current_studio_id());

create policy "studio members can read payments"
  on public.payments for select
  using (studio_id = public.current_studio_id());

create policy "studio members can insert payments"
  on public.payments for insert
  with check (
    studio_id = public.current_studio_id()
    and member_id in (select id from public.members where studio_id = public.current_studio_id())
  );

create policy "studio members can update payments"
  on public.payments for update
  using (studio_id = public.current_studio_id())
  with check (
    studio_id = public.current_studio_id()
    and member_id in (select id from public.members where studio_id = public.current_studio_id())
  );

create policy "studio members can delete payments"
  on public.payments for delete
  using (studio_id = public.current_studio_id());
