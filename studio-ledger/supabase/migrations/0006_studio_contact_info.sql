-- Studio Ledger — owner-editable contact info, shown in the client-facing
-- footer (check-in / intake pages). All optional: a studio that hasn't
-- filled these in yet just shows no footer, rather than blank lines.

alter table public.studios
  add column if not exists contact_phone_1 text,
  add column if not exists contact_phone_2 text,
  add column if not exists contact_email text,
  add column if not exists contact_address text,
  add column if not exists website_url text;

-- ---------------------------------------------------------------------------
-- get_intake_studio / get_checkin_studio: extended to also return the
-- contact fields above, so the public page can render a footer without
-- needing a separate authenticated call. Return type changed, so both are
-- dropped before recreating.
-- ---------------------------------------------------------------------------

drop function if exists public.get_intake_studio(text);

create or replace function public.get_intake_studio(intake_slug text)
returns table (
  name text,
  business_type text,
  contact_phone_1 text,
  contact_phone_2 text,
  contact_email text,
  contact_address text,
  website_url text
)
language sql
stable
security definer
set search_path = public
as $$
  select s.name, s.business_type, s.contact_phone_1, s.contact_phone_2, s.contact_email,
         s.contact_address, s.website_url
  from public.studios s
  where s.public_intake_slug = intake_slug
    and s.public_intake_enabled = true
$$;

grant execute on function public.get_intake_studio(text) to anon;

drop function if exists public.get_checkin_studio(text);

create or replace function public.get_checkin_studio(intake_slug text)
returns table (
  name text,
  business_type text,
  contact_phone_1 text,
  contact_phone_2 text,
  contact_email text,
  contact_address text,
  website_url text
)
language sql
stable
security definer
set search_path = public
as $$
  select s.name, s.business_type, s.contact_phone_1, s.contact_phone_2, s.contact_email,
         s.contact_address, s.website_url
  from public.studios s
  where s.public_intake_slug = intake_slug
    and s.public_checkin_enabled = true
$$;

grant execute on function public.get_checkin_studio(text) to anon;
