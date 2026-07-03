-- Version 2.8 - Protected Routes & Business Ownership
-- Associates each business profile with the authenticated user that owns it.
--
-- owner_id is added as a NULLABLE column so that existing rows are preserved.
-- Existing rows are left as NULL (backfilled as NULL) — no data is deleted.
-- New profiles created by the application will populate owner_id with the
-- authenticated user's id.

alter table public.business_profiles
  add column if not exists owner_id uuid references auth.users(id);

-- Existing rows intentionally remain NULL. No backfill of real owners is
-- possible because pre-auth profiles were created without an owner.
