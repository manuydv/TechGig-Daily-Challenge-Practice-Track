-- Fix: "new row violates row-level security policy" when a client uploads
-- their own photo from the check-in page.
--
-- The 0009 storage policies checked `exists (select 1 from public.members
-- where id = ... )` directly. That subquery runs AS the calling role (anon
-- for a client), and members' own RLS ("studio members can read members",
-- scoped to authenticated staff) blocks anon from reading any row at all —
-- so the subquery was always empty for a client, regardless of the policy's
-- "or auth.role() = 'anon'" clause. Fix: route the check through a
-- SECURITY DEFINER function, which reads members with the function owner's
-- privileges instead of the caller's, bypassing that RLS the same way
-- current_studio_id() already does elsewhere.

create or replace function public.can_write_member_photo(p_member_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  mem public.members;
begin
  select * into mem from public.members where id = p_member_id;
  if mem.id is null then
    return false;
  end if;
  if auth.role() = 'anon' then
    return true;
  end if;
  return mem.studio_id = public.current_studio_id();
end;
$$;

drop policy if exists "staff or the member can upload their own photo" on storage.objects;
create policy "staff or the member can upload their own photo"
  on storage.objects for insert
  with check (
    bucket_id = 'member-photos'
    and public.can_write_member_photo(nullif((storage.foldername(name))[1], '')::uuid)
  );

drop policy if exists "staff or the member can update their own photo" on storage.objects;
create policy "staff or the member can update their own photo"
  on storage.objects for update
  using (
    bucket_id = 'member-photos'
    and public.can_write_member_photo(nullif((storage.foldername(name))[1], '')::uuid)
  )
  with check (
    bucket_id = 'member-photos'
    and public.can_write_member_photo(nullif((storage.foldername(name))[1], '')::uuid)
  );
