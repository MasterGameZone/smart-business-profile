-- Version 3.5 - Profile Enrichment Schema Foundation
-- Adds optional fields that prepare business profiles for future enrichment UI.
--
-- This migration is intentionally non-destructive:
--   - no columns are dropped or renamed
--   - existing data is preserved
--   - existing RLS policies are not changed
--   - profile enrichment fields remain optional for existing create/edit flows

alter table public.business_profiles
  add column if not exists tagline text,
  add column if not exists services jsonb default '[]'::jsonb,
  add column if not exists working_hours jsonb default '{}'::jsonb,
  add column if not exists google_maps_url text,
  add column if not exists social_links jsonb default '{}'::jsonb,
  add column if not exists keywords text[] default ARRAY[]::text[],
  add column if not exists cover_banner_url text,
  add column if not exists gallery_images text[] default ARRAY[]::text[],
  add column if not exists is_public boolean default true;
