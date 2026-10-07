-- Attendance is now owner-marked only. Self check-in (the public
-- phone+PIN page) no longer logs a visit itself — it stays as the
-- member's own account view (stats, batch, payment info, profile edit),
-- just without the side effect of creating an attendance record. Only the
-- owner marking someone present, from the new Check-in tab, writes to
-- visits now.
--
-- That removes the one real reason two visit rows could ever collide for
-- the same member on the same day (a self check-in racing an owner mark),
-- so a hard one-row-per-member-per-day rule is now safe to add.

-- Dedupe any existing same-day rows before the constraint can be added
-- (keeps the earliest row per member/day, drops the rest).
delete from public.visits a using public.visits b
where a.member_id = b.member_id
  and a.visited_on = b.visited_on
  and a.id > b.id;

alter table public.visits
  add constraint visits_member_day_unique unique (member_id, visited_on);

-- ---------------------------------------------------------------------------
-- public_check_in: drop the visit insert. Everything else (auth via
-- phone+PIN, the lockout, returning stats/batch/payment/profile info) is
-- unchanged.
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
