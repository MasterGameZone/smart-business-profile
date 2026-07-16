-- Store Business Owner account profile details for authenticated users.

create table if not exists public.business_owner_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  name text,
  phone_number text,
  preferred_city text,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

alter table public.business_owner_profiles enable row level security;

revoke all on table public.business_owner_profiles from anon;
revoke all on table public.business_owner_profiles from public;
grant select, insert, update on table public.business_owner_profiles to authenticated;

drop policy if exists "Users can read their own business owner profile" on public.business_owner_profiles;
create policy "Users can read their own business owner profile"
on public.business_owner_profiles
for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users can insert their own business owner profile" on public.business_owner_profiles;
create policy "Users can insert their own business owner profile"
on public.business_owner_profiles
for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update their own business owner profile" on public.business_owner_profiles;
create policy "Users can update their own business owner profile"
on public.business_owner_profiles
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop trigger if exists set_business_owner_profiles_updated_at on public.business_owner_profiles;
create trigger set_business_owner_profiles_updated_at
before update on public.business_owner_profiles
for each row
execute function public.set_updated_at();
