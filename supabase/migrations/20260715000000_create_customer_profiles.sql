-- Store customer profile and location preferences for authenticated users.

create table if not exists public.customer_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  customer_name text,
  phone_number text,
  preferred_city text,
  preferred_area text,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

alter table public.customer_profiles enable row level security;

revoke all on table public.customer_profiles from anon;
revoke all on table public.customer_profiles from public;
grant select, insert, update on table public.customer_profiles to authenticated;

drop policy if exists "Users can read their own customer profile" on public.customer_profiles;
create policy "Users can read their own customer profile"
on public.customer_profiles
for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users can insert their own customer profile" on public.customer_profiles;
create policy "Users can insert their own customer profile"
on public.customer_profiles
for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update their own customer profile" on public.customer_profiles;
create policy "Users can update their own customer profile"
on public.customer_profiles
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop trigger if exists set_customer_profiles_updated_at on public.customer_profiles;
create trigger set_customer_profiles_updated_at
before update on public.customer_profiles
for each row
execute function public.set_updated_at();
