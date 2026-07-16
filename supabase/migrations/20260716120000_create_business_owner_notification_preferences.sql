-- Business Owner notification preferences.
-- Stores private in-app notification On/Off settings for business owners.

create table if not exists public.business_owner_notification_preferences (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  notifications_enabled boolean not null default true,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

alter table public.business_owner_notification_preferences enable row level security;

revoke all on table public.business_owner_notification_preferences from anon;
revoke all on table public.business_owner_notification_preferences from public;
grant select, insert, update on table public.business_owner_notification_preferences to authenticated;

drop policy if exists "Business owners can read their own notification preferences" on public.business_owner_notification_preferences;
create policy "Business owners can read their own notification preferences"
on public.business_owner_notification_preferences
for select
to authenticated
using ((select auth.uid()) = owner_id);

drop policy if exists "Business owners can insert their own notification preferences" on public.business_owner_notification_preferences;
create policy "Business owners can insert their own notification preferences"
on public.business_owner_notification_preferences
for insert
to authenticated
with check ((select auth.uid()) = owner_id);

drop policy if exists "Business owners can update their own notification preferences" on public.business_owner_notification_preferences;
create policy "Business owners can update their own notification preferences"
on public.business_owner_notification_preferences
for update
to authenticated
using ((select auth.uid()) = owner_id)
with check ((select auth.uid()) = owner_id);

drop trigger if exists set_business_owner_notification_preferences_updated_at on public.business_owner_notification_preferences;
create trigger set_business_owner_notification_preferences_updated_at
before update on public.business_owner_notification_preferences
for each row
execute function public.set_updated_at();
