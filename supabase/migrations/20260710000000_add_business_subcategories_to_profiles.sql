-- Version 4.21 - Business profile subcategories
-- Adds optional multi-select subcategories while keeping old profiles compatible.

alter table public.business_profiles
  add column if not exists business_subcategories text[];
