-- Persist the authenticated user's preferred account mode independently of business profiles.

create table if not exists public.user_account_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  owner_enabled boolean not null default false,
  preferred_account_mode text not null default 'customer',
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint user_account_preferences_preferred_mode_check
    check (preferred_account_mode in ('customer', 'business_owner'))
);

alter table public.user_account_preferences enable row level security;

grant select, insert, update on table public.user_account_preferences to authenticated;

drop policy if exists "Users can read their own account preferences" on public.user_account_preferences;
create policy "Users can read their own account preferences"
on public.user_account_preferences
for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users can insert their own account preferences" on public.user_account_preferences;
create policy "Users can insert their own account preferences"
on public.user_account_preferences
for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update their own account preferences" on public.user_account_preferences;
create policy "Users can update their own account preferences"
on public.user_account_preferences
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop trigger if exists set_user_account_preferences_updated_at on public.user_account_preferences;
create trigger set_user_account_preferences_updated_at
before update on public.user_account_preferences
for each row
execute function public.set_updated_at();
