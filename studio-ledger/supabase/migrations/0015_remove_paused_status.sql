-- Drop "paused" as a member status. Status is now purely two values —
-- active / inactive — and purely automatic (paid in the current or
-- previous month = active, otherwise inactive). The owner no longer sets
-- status by hand at all; there's nothing left for a manual-only state to
-- protect from the automation, so "paused" has no reason to exist.

update public.members set status = 'inactive' where status = 'paused';

alter table public.members drop constraint if exists members_status_check;
alter table public.members add constraint members_status_check check (status in ('active', 'inactive'));

-- ---------------------------------------------------------------------------
-- payments_sync_member_status: drop the "skip if paused" branch — every
-- member is auto-managed now.
-- ---------------------------------------------------------------------------

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
  if mem.id is null then
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
