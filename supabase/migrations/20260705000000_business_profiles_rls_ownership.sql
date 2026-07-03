-- Version 2.8 - Row Level Security for Business Ownership
-- Replaces the temporary development policies (which allowed unrestricted
-- anonymous access) with ownership-based policies.
--
-- Rules:
--   Authenticated users:
--     - Can create profiles they own (owner_id must equal their user id).
--     - Can update only their own profiles.
--   Anonymous users:
--     - Can read public business profiles.
--     - Cannot create or update profiles.

-- Remove temporary development policies.
drop policy if exists "Temporary: allow anon insert" on public.business_profiles;
drop policy if exists "Temporary: allow anon select" on public.business_profiles;
drop policy if exists "Temporary: allow anon update" on public.business_profiles;

-- Public read: anyone (anonymous or authenticated) can read business profiles,
-- keeping public profile pages accessible without authentication.
drop policy if exists "Public can read business profiles" on public.business_profiles;
create policy "Public can read business profiles"
on public.business_profiles
for select
to anon, authenticated
using (true);

-- Authenticated users can create profiles, but only ones they own.
drop policy if exists "Users can insert their own profiles" on public.business_profiles;
create policy "Users can insert their own profiles"
on public.business_profiles
for insert
to authenticated
with check (owner_id = auth.uid());

-- Authenticated users can update only their own profiles.
drop policy if exists "Users can update their own profiles" on public.business_profiles;
create policy "Users can update their own profiles"
on public.business_profiles
for update
to authenticated
using (owner_id = auth.uid())
with check (owner_id = auth.uid());
