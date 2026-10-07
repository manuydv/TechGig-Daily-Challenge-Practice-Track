-- Fix: a member with real payment history could still be stuck "active"
-- forever if their joined_on happened to be wrong or recent.
--
-- The grace period (added in 0007) only checked joined_on < grace_start
-- before allowing the active -> inactive flip. That's fragile: if
-- joined_on is off for any reason (a data-entry slip, an import quirk, a
-- field edited later), a member with months of real payment rows —
-- clearly not "brand new" — could be shielded from ever going inactive,
-- no matter how long they've been unpaid.
--
-- Fix: a member only gets grace if BOTH joined_on is recent AND they have
-- no payment record at all for a month before this one. Having an actual
-- payment row (paid or not) from an earlier month means their payment
-- cycle has already started, so the normal 2-month rule should apply
-- regardless of what joined_on says.

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
  has_prior_history boolean;
begin
  select * into mem from public.members where id = new.member_id;
  if mem.id is null then
    return new;
  end if;

  select exists (
    select 1 from public.payments p
    where p.member_id = new.member_id
      and p.month in (this_month, prev_month)
      and p.paid = true
  ) into has_recent_paid;

  select exists (
    select 1 from public.payments p
    where p.member_id = new.member_id
      and p.month < this_month
  ) into has_prior_history;

  if has_recent_paid then
    update public.members set status = 'active' where id = new.member_id and status <> 'active';
  elsif mem.joined_on < grace_start or has_prior_history then
    update public.members set status = 'inactive' where id = new.member_id and status <> 'inactive';
  end if;

  return new;
end;
$$;

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
    and (
      m.joined_on < grace_start
      or exists (
        select 1 from public.payments p
        where p.member_id = m.id
          and p.month < this_month
      )
    )
    and not exists (
      select 1 from public.payments p
      where p.member_id = m.id
        and p.month in (this_month, prev_month)
        and p.paid = true
    );
end;
$$;
