-- Studio Ledger — employees (payroll) + expenses (rent, cleaning, etc.)
-- Both are simple studio-scoped ledgers, following the same RLS pattern as
-- `members`: studio_id is supplied by the client and checked directly
-- against current_studio_id() (no derivation trigger needed, since neither
-- table hangs off another owned row the way payments/visits hang off
-- members).

-- ---------------------------------------------------------------------------
-- employees: people the shop pays (not necessarily app users — see
-- staff_users for who can log in). Tracked for payroll/financials.
-- ---------------------------------------------------------------------------

create table if not exists public.employees (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.studios (id) on delete cascade,
  name text not null,
  role_title text,
  phone text,
  email text,
  monthly_pay numeric(10, 2) not null default 0 check (monthly_pay >= 0),
  status text not null default 'active' check (status in ('active', 'inactive')),
  joined_on date not null default current_date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists employees_studio_id_idx on public.employees (studio_id);

drop trigger if exists employees_set_updated_at on public.employees;
create trigger employees_set_updated_at
  before update on public.employees
  for each row
  execute function public.set_updated_at();

alter table public.employees enable row level security;

create policy "studio members can read employees"
  on public.employees for select
  using (studio_id = public.current_studio_id());

create policy "studio members can insert employees"
  on public.employees for insert
  with check (studio_id = public.current_studio_id());

create policy "studio members can update employees"
  on public.employees for update
  using (studio_id = public.current_studio_id())
  with check (studio_id = public.current_studio_id());

create policy "studio members can delete employees"
  on public.employees for delete
  using (studio_id = public.current_studio_id());

-- ---------------------------------------------------------------------------
-- expenses: a simple ledger for rent, cleaning, utilities, etc. Not tied to
-- a specific month/recurrence — each payment of rent, each cleaning bill,
-- is its own dated entry, the same way a real expense ledger works.
-- ---------------------------------------------------------------------------

create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.studios (id) on delete cascade,
  category text not null default 'other'
    check (category in ('rent', 'cleaning', 'utilities', 'supplies', 'payroll', 'other')),
  description text,
  amount numeric(10, 2) not null check (amount >= 0),
  expense_date date not null default current_date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists expenses_studio_id_idx on public.expenses (studio_id, expense_date desc);

drop trigger if exists expenses_set_updated_at on public.expenses;
create trigger expenses_set_updated_at
  before update on public.expenses
  for each row
  execute function public.set_updated_at();

alter table public.expenses enable row level security;

create policy "studio members can read expenses"
  on public.expenses for select
  using (studio_id = public.current_studio_id());

create policy "studio members can insert expenses"
  on public.expenses for insert
  with check (studio_id = public.current_studio_id());

create policy "studio members can update expenses"
  on public.expenses for update
  using (studio_id = public.current_studio_id())
  with check (studio_id = public.current_studio_id());

create policy "studio members can delete expenses"
  on public.expenses for delete
  using (studio_id = public.current_studio_id());
