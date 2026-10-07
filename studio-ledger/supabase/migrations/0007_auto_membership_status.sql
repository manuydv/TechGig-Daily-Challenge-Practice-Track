-- Automatic active/inactive status based on payment history.
--
-- Rule: a member is "active" if they have a paid payment for the current
-- month or the previous month, "inactive" otherwise. "paused" stays a
-- manual-only status (e.g. a planned break) and is never touched here.
--
-- New members get a 2-month grace period from joined_on before the
-- "inactive" side of the rule can apply, so someone who just signed up
-- and hasn't paid their first month yet isn't instantly flagged inactive.
--
-- Two mechanisms keep this in sync:
--   1. A trigger on payments, for instant updates when a payment is
--      marked/unmarked paid.
--   2. An RPC (sync_member_statuses) the app calls on load, to catch
--      members who simply went unpaid as months passed with no new
--      payment row to trigger off of.

create or replace function public.payments_sync_member_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  this_month text := to_char(current_date, 'YYYY-MM');
  prev_month text := to_char(current_date - interval '1 month', 'YYYY-MM');
  grace_start date := date_trunc('month', current_date - interval '1 month')::date;
  mem public.members;
  has_recent_paid boolean;
begin
  select * into mem from public.members where id = new.member_id;
  if mem.id is null or mem.status = 'paused' then
    return new;
  end if;

  select exists (
    select 1 from public.payments p
    where p.member_id = new.member_id
      and p.month in (this_month, prev_month)
      and p.paid = true
  ) into has_recent_paid;

  if has_recent_paid then
    update public.members set status = 'active' where id = new.member_id and status <> 'active';
  elsif mem.joined_on < grace_start then
    update public.members set status = 'inactive' where id = new.member_id and status <> 'inactive';
  end if;

  return new;
end;
$$;

drop trigger if exists payments_sync_member_status on public.payments;
create trigger payments_sync_member_status
  after insert or update of paid on public.payments
  for each row
  execute function public.payments_sync_member_status();

create or replace function public.sync_member_statuses()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  sid uuid := public.current_studio_id();
  this_month text := to_char(current_date, 'YYYY-MM');
  prev_month text := to_char(current_date - interval '1 month', 'YYYY-MM');
  grace_start date := date_trunc('month', current_date - interval '1 month')::date;
begin
  if sid is null then
    return;
  end if;

  update public.members m
  set status = 'active'
  where m.studio_id = sid
    and m.status = 'inactive'
    and exists (
      select 1 from public.payments p
      where p.member_id = m.id
        and p.month in (this_month, prev_month)
        and p.paid = true
    );

  update public.members m
  set status = 'inactive'
  where m.studio_id = sid
    and m.status = 'active'
    and m.joined_on < grace_start
    and not exists (
      select 1 from public.payments p
      where p.member_id = m.id
        and p.month in (this_month, prev_month)
        and p.paid = true
    );
end;
$$;
