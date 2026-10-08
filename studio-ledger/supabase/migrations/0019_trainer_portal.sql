-- Trainer/instructor portal.
--
-- Owner side: an employee can now have a photo, date of birth, and a
-- check-in PIN (same fields/shape as members), set from the Employee
-- detail screen. Setting a PIN is what makes that employee able to use
-- the trainer portal below — it's optional, same as a member's PIN.
--
-- Trainer side: a new public link (/trainer/:slug, same slug as the
-- member check-in link, gated by the same public_checkin_enabled flag)
-- lets an employee log in with their phone + PIN to see their own name
-- and photo (instead of membership info), and mark member attendance by
-- day and batch — the exact same tool the owner has on the Check-in tab,
-- just reachable without an owner login. Every trainer RPC re-checks the
-- phone+PIN on each call (no server-side session), following the same
-- pattern as the member account page's public_update_profile etc., and
-- shares the same lockout table/helpers.

alter table public.employees
  add column if not exists photo_url text,
  add column if not exists date_of_birth date,
  add column if not exists check_in_pin text;

-- ---------------------------------------------------------------------------
-- Storage: a public bucket for employee/instructor photos, uploaded by
-- studio staff only (owner-managed from the Employee detail screen, same
-- as member-photos). Objects are stored at "<employee_id>/<filename>".
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('employee-photos', 'employee-photos', true)
on conflict (id) do nothing;

drop policy if exists "employee photos are publicly readable" on storage.objects;
create policy "employee photos are publicly readable"
  on storage.objects for select
  using (bucket_id = 'employee-photos');

drop policy if exists "studio staff can upload employee photos" on storage.objects;
create policy "studio staff can upload employee photos"
  on storage.objects for insert
  with check (
    bucket_id = 'employee-photos'
    and exists (
      select 1 from public.employees e
      where e.id::text = (storage.foldername(name))[1]
        and e.studio_id = public.current_studio_id()
    )
  );

drop policy if exists "studio staff can update employee photos" on storage.objects;
create policy "studio staff can update employee photos"
  on storage.objects for update
  using (
    bucket_id = 'employee-photos'
    and exists (
      select 1 from public.employees e
      where e.id::text = (storage.foldername(name))[1]
        and e.studio_id = public.current_studio_id()
    )
  )
  with check (
    bucket_id = 'employee-photos'
    and exists (
      select 1 from public.employees e
      where e.id::text = (storage.foldername(name))[1]
        and e.studio_id = public.current_studio_id()
    )
  );

drop policy if exists "studio staff can delete employee photos" on storage.objects;
create policy "studio staff can delete employee photos"
  on storage.objects for delete
  using (
    bucket_id = 'employee-photos'
    and exists (
      select 1 from public.employees e
      where e.id::text = (storage.foldername(name))[1]
        and e.studio_id = public.current_studio_id()
    )
  );

-- ---------------------------------------------------------------------------
-- trainer_authenticate: internal helper, re-used by every trainer RPC
-- below. Not granted to anon directly — only ever called from inside
-- another SECURITY DEFINER function. Mirrors the member phone+PIN auth
-- pattern exactly, except there's no last-4-digits fallback: a trainer's
-- PIN is set deliberately by the owner, not self-claimed.
-- ---------------------------------------------------------------------------

create or replace function public.trainer_authenticate(
  intake_slug text,
  phone text,
  pin text
)
returns public.employees
language plpgsql
security definer
set search_path = public
as $$
declare
  target_studio_id uuid;
  target_employee public.employees;
  phone_key text := public.normalize_phone(phone);
begin
  select id into target_studio_id
  from public.studios
  where public_intake_slug = intake_slug
    and public_checkin_enabled = true;

  if target_studio_id is null then
    raise exception 'This link is not active.';
  end if;

  if nullif(trim(coalesce(phone, '')), '') is null
    or nullif(trim(coalesce(pin, '')), '') is null then
    raise exception 'Enter your phone number and PIN.';
  end if;

  perform public.assert_not_locked_out(target_studio_id, phone_key);

  select * into target_employee
  from public.employees e
  where e.studio_id = target_studio_id
    and public.normalize_phone(e.phone) = phone_key
    and e.check_in_pin is not null
    and e.check_in_pin = trim(pin);

  if target_employee.id is null then
    perform public.record_checkin_attempt(target_studio_id, phone_key, false);
    raise exception 'We could not find that phone number and PIN. Ask the studio owner.';
  end if;

  perform public.record_checkin_attempt(target_studio_id, phone_key, true);

  return target_employee;
end;
$$;

-- ---------------------------------------------------------------------------
-- public_trainer_login: the first call on the trainer portal. Returns just
-- enough to render the "who am I" card — no phone/email/salary, since the
-- portal never needs to display those back to the trainer.
-- ---------------------------------------------------------------------------

create or replace function public.public_trainer_login(
  intake_slug text,
  phone text,
  pin text
)
returns table (employee_id uuid, name text, photo_url text, role_title text)
language plpgsql
security definer
set search_path = public
as $$
declare
  emp public.employees;
begin
  emp := public.trainer_authenticate(intake_slug, phone, pin);
  return query select emp.id, emp.name, emp.photo_url, emp.role_title;
end;
$$;

grant execute on function public.public_trainer_login(text, text, text) to anon;

-- ---------------------------------------------------------------------------
-- public_trainer_classes: the batch picker for the trainer's check-in
-- tool. Same list the owner's Check-in tab shows.
-- ---------------------------------------------------------------------------

create or replace function public.public_trainer_classes(
  intake_slug text,
  phone text,
  pin text
)
returns setof public.classes
language plpgsql
security definer
set search_path = public
as $$
declare
  emp public.employees;
begin
  emp := public.trainer_authenticate(intake_slug, phone, pin);
  return query
  select * from public.classes where studio_id = emp.studio_id order by start_time;
end;
$$;

grant execute on function public.public_trainer_classes(text, text, text) to anon;

-- ---------------------------------------------------------------------------
-- public_trainer_roster: the member list + that day's attendance, filtered
-- by batch exactly like the owner's Check-in tab (class_filter is 'all',
-- 'none', or a class id as text).
-- ---------------------------------------------------------------------------

create or replace function public.public_trainer_roster(
  intake_slug text,
  phone text,
  pin text,
  class_filter text,
  for_date date
)
returns table (member_id uuid, name text, member_phone text, photo_url text, present boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  emp public.employees;
begin
  emp := public.trainer_authenticate(intake_slug, phone, pin);

  return query
  select m.id, m.name, m.phone, m.photo_url,
    exists (
      select 1 from public.visits v
      where v.member_id = m.id and v.visited_on = for_date
    )
  from public.members m
  where m.studio_id = emp.studio_id
    and (
      class_filter = 'all'
      or (class_filter = 'none' and m.class_id is null)
      or (class_filter not in ('all', 'none') and m.class_id = class_filter::uuid)
    )
  order by m.name;
end;
$$;

grant execute on function public.public_trainer_roster(text, text, text, text, date) to anon;

-- ---------------------------------------------------------------------------
-- public_trainer_toggle_attendance: mark or unmark a member present for a
-- given day. Same rule as the owner's tool — can edit today or any past
-- day (to fix a missed mark), never a future date.
-- ---------------------------------------------------------------------------

create or replace function public.public_trainer_toggle_attendance(
  intake_slug text,
  phone text,
  pin text,
  target_member_id uuid,
  for_date date,
  present boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  emp public.employees;
  target_member public.members;
begin
  emp := public.trainer_authenticate(intake_slug, phone, pin);

  if for_date > current_date then
    raise exception 'Cannot mark attendance for a future date.';
  end if;

  select * into target_member
  from public.members
  where id = target_member_id and studio_id = emp.studio_id;

  if target_member.id is null then
    raise exception 'Member not found.';
  end if;

  if present then
    insert into public.visits (studio_id, member_id, visited_on, notes)
    values (emp.studio_id, target_member.id, for_date, 'Marked by ' || emp.name)
    on conflict (member_id, visited_on) do nothing;
  else
    delete from public.visits where member_id = target_member.id and visited_on = for_date;
  end if;
end;
$$;

grant execute on function public.public_trainer_toggle_attendance(text, text, text, uuid, date, boolean) to anon;
