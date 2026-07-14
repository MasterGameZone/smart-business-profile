-- Add support for multiple business subcategories.

alter table public.business_profiles
add column if not exists business_subcategories text[];
