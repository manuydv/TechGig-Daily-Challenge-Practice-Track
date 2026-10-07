-- Owner-configured payment options (UPI ID + QR code), shown to a member
-- under "My info" on the check-in page as "Make payment".

alter table public.studios
  add column if not exists upi_id text,
  add column if not exists payment_qr_url text;

-- ---------------------------------------------------------------------------
-- Storage: a public bucket for the studio's payment QR code image, uploaded
-- by studio staff only. Stored at "<studio_id>/qr.<ext>".
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('payment-qr', 'payment-qr', true)
on conflict (id) do nothing;

create policy "payment qr codes are publicly readable"
  on storage.objects for select
  using (bucket_id = 'payment-qr');

create policy "studio staff can upload their payment qr"
  on storage.objects for insert
  with check (
    bucket_id = 'payment-qr'
    and (storage.foldername(name))[1] = public.current_studio_id()::text
  );

create policy "studio staff can update their payment qr"
  on storage.objects for update
  using (
    bucket_id = 'payment-qr'
    and (storage.foldername(name))[1] = public.current_studio_id()::text
  )
  with check (
    bucket_id = 'payment-qr'
    and (storage.foldername(name))[1] = public.current_studio_id()::text
  );

create policy "studio staff can delete their payment qr"
  on storage.objects for delete
  using (
    bucket_id = 'payment-qr'
    and (storage.foldername(name))[1] = public.current_studio_id()::text
  );

-- ---------------------------------------------------------------------------
-- get_checkin_studio: also return upi_id + payment_qr_url, so the check-in
-- page can show "Make payment" without a separate authenticated call.
-- ---------------------------------------------------------------------------

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
  upi_id text,
  payment_qr_url text
)
language sql
stable
security definer
set search_path = public
as $$
  select s.name, s.business_type, s.contact_phone_1, s.contact_phone_2, s.contact_email,
         s.contact_address, s.website_url, s.upi_id, s.payment_qr_url
  from public.studios s
  where s.public_intake_slug = intake_slug
    and s.public_checkin_enabled = true
$$;

grant execute on function public.get_checkin_studio(text) to anon;
