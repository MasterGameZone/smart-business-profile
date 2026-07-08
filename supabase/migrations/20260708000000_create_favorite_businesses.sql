-- Version 4.15 - Saved Businesses / Favorites
-- Adds a user-owned favorites table for saving public business profiles.

create table if not exists public.favorite_businesses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  business_profile_id uuid not null references public.business_profiles (id) on delete cascade,
  created_at timestamp with time zone not null default now(),
  constraint favorite_businesses_user_id_business_profile_id_key unique (user_id, business_profile_id)
);

alter table public.favorite_businesses enable row level security;

drop policy if exists "Users can read their own favorite businesses" on public.favorite_businesses;
create policy "Users can read their own favorite businesses"
on public.favorite_businesses
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "Users can insert their own favorite businesses" on public.favorite_businesses;
create policy "Users can insert their own favorite businesses"
on public.favorite_businesses
for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "Users can delete their own favorite businesses" on public.favorite_businesses;
create policy "Users can delete their own favorite businesses"
on public.favorite_businesses
for delete
to authenticated
using (user_id = auth.uid());
