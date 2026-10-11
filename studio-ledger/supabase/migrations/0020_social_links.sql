-- Footer social/map links: Instagram, a Google search/listing link, and a
-- map location link, shown as icons on the member/trainer portal footer,
-- above the phone numbers. Same owner-editable pattern as website_url.

alter table public.studios
  add column if not exists instagram_url text,
  add column if not exists google_url text,
  add column if not exists map_url text;

drop function if exists public.get_checkin_studio(text);

create or replace function public.get_checkin_studio(intake_slug text)
returns table (
  name text,
  business_type text,
  contact_phone_1 text,
  contact_phone_2 text,
  contact_email text,
  contact_address text,
  website_url text,
  instagram_url text,
  google_url text,
  map_url text,
  upi_id text,
  payment_qr_url text
)
language sql
stable
security definer
set search_path = public
as $$
  select s.name, s.business_type, s.contact_phone_1, s.contact_phone_2, s.contact_email,
         s.contact_address, s.website_url, s.instagram_url, s.google_url, s.map_url,
         s.upi_id, s.payment_qr_url
  from public.studios s
  where s.public_intake_slug = intake_slug
    and s.public_checkin_enabled = true
$$;

grant execute on function public.get_checkin_studio(text) to anon;
