-- Business profile saves analytics.
-- Returns an aggregate save count for the authenticated owner of a business profile
-- without exposing individual favorite_businesses rows.

create or replace function public.get_business_profile_saves_count(target_profile_id uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select case
    when target_profile_id is null then 0
    when exists (
      select 1
      from public.business_profiles
      where business_profiles.id = target_profile_id
        and business_profiles.owner_id = (select auth.uid())
    )
    then (
      select count(*)::integer
      from public.favorite_businesses
      where favorite_businesses.business_profile_id = target_profile_id
    )
    else 0
  end;
$$;

revoke all on function public.get_business_profile_saves_count(uuid) from public;
revoke all on function public.get_business_profile_saves_count(uuid) from anon;
revoke all on function public.get_business_profile_saves_count(uuid) from authenticated;

grant execute on function public.get_business_profile_saves_count(uuid) to authenticated;
