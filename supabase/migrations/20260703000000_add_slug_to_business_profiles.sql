-- Version 2.3 - Public Business Slug & Profile Retrieval
-- Adds a permanent, human-readable, unique slug to business_profiles.

alter table public.business_profiles
  add column if not exists slug text;

-- Backfill existing rows with a deterministic, unique slug derived from business_name.
-- Existing business_name values are not guaranteed unique, so the row id is appended
-- as a safe uniqueness suffix during backfill only (new inserts use numeric suffixes).
with backfill as (
  select
    id,
    trim(
      both '-' from
      regexp_replace(
        regexp_replace(
          regexp_replace(lower(trim(business_name)), '[^a-z0-9\s-]', '', 'g'),
          '\s+', '-', 'g'
        ),
        '-+', '-', 'g'
      )
    ) as base_slug
  from public.business_profiles
  where slug is null
)
update public.business_profiles bp
set slug = coalesce(nullif(backfill.base_slug, ''), 'business') || '-' || substr(bp.id::text, 1, 8)
from backfill
where bp.id = backfill.id
  and bp.slug is null;

alter table public.business_profiles
  alter column slug set not null;

create unique index if not exists business_profiles_slug_key
  on public.business_profiles (slug);
