-- Return minimal profile-start state for the current customer's support invites.
-- This avoids exposing invited owner ids or unpublished business profile data.

drop function if exists public.get_customer_support_invite_profile_states();

create function public.get_customer_support_invite_profile_states()
returns table (
  support_id uuid,
  profile_started boolean
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_customer_id uuid := auth.uid();
begin
  if v_customer_id is null then
    return;
  end if;

  return query
  select
    customer_business_supports.id as support_id,
    exists (
      select 1
      from public.business_profiles
      where business_profiles.owner_id = customer_business_supports.invited_owner_user_id
    ) as profile_started
  from public.customer_business_supports
  where customer_business_supports.customer_id = v_customer_id
    and customer_business_supports.invited_owner_user_id is not null;
end;
$$;

revoke all on function public.get_customer_support_invite_profile_states() from public;
grant execute on function public.get_customer_support_invite_profile_states() to authenticated;

notify pgrst, 'reload schema';
