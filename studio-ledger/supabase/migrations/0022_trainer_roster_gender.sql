-- Trainer check-in roster now also returns each member's gender, so the
-- trainer portal can show the same gender-tinted default avatar the owner
-- app uses for a member with no uploaded photo.

drop function if exists public.public_trainer_roster(text, text, text, text, date);

create or replace function public.public_trainer_roster(
  intake_slug text,
  phone text,
  pin text,
  class_filter text,
  for_date date
)
returns table (member_id uuid, name text, member_phone text, photo_url text, gender text, present boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  emp public.employees;
begin
  emp := public.trainer_authenticate(intake_slug, phone, pin);

  return query
  select m.id, m.name, m.phone, m.photo_url, m.gender,
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
