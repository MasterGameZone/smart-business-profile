-- Business profile followers.
-- Stores authenticated user follows for public business profiles.

create table if not exists public.business_profile_followers (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.business_profiles(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamp with time zone not null default now(),
  constraint business_profile_followers_profile_user_unique unique (profile_id, user_id)
);

create index if not exists business_profile_followers_profile_id_idx
on public.business_profile_followers (profile_id);

create index if not exists business_profile_followers_user_id_idx
on public.business_profile_followers (user_id);

alter table public.business_profile_followers enable row level security;

revoke all on table public.business_profile_followers from anon;
revoke all on table public.business_profile_followers from public;
grant select, insert, delete on table public.business_profile_followers to authenticated;

drop policy if exists "Users can read their own business profile follows" on public.business_profile_followers;
create policy "Users can read their own business profile follows"
on public.business_profile_followers
for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users can follow public profiles they do not own" on public.business_profile_followers;
create policy "Users can follow public profiles they do not own"
on public.business_profile_followers
for insert
to authenticated
with check (
  (select auth.uid()) = user_id
  and exists (
    select 1
    from public.business_profiles
    where business_profiles.id = profile_id
      and business_profiles.is_public is not false
      and coalesce(business_profiles.owner_id, '00000000-0000-0000-0000-000000000000'::uuid) <> (select auth.uid())
  )
);

drop policy if exists "Users can unfollow their own business profile follows" on public.business_profile_followers;
create policy "Users can unfollow their own business profile follows"
on public.business_profile_followers
for delete
to authenticated
using ((select auth.uid()) = user_id);

create or replace function public.get_business_profile_followers_count(target_profile_id uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::integer
  from public.business_profile_followers
  where profile_id = target_profile_id
    and exists (
      select 1
      from public.business_profiles
      where business_profiles.id = target_profile_id
        and business_profiles.is_public is not false
    );
$$;

revoke all on function public.get_business_profile_followers_count(uuid) from public;
grant execute on function public.get_business_profile_followers_count(uuid) to anon;
grant execute on function public.get_business_profile_followers_count(uuid) to authenticated;
