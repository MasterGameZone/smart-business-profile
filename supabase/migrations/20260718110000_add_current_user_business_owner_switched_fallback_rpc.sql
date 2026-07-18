-- Fallback milestone tracker for invited owners who no longer have the invite token locally.
-- Marks all eligible claimed, non-published support invites for the current authenticated user.

drop function if exists public.mark_current_user_support_invite_business_owner_switched();

create function public.mark_current_user_support_invite_business_owner_switched()
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_updated_count integer := 0;
begin
  if v_user_id is null then
    return false;
  end if;

  update public.customer_business_supports
  set
    business_owner_switched_at = now(),
    status = 'Switched to Business Owner',
    updated_at = now()
  where invited_owner_user_id = v_user_id
    and business_signed_up_at is not null
    and business_owner_switched_at is null
    and published_profile_id is null
    and status <> 'Profile Published';

  get diagnostics v_updated_count = row_count;

  return v_updated_count > 0;
end;
$$;

revoke all on function public.mark_current_user_support_invite_business_owner_switched() from public;
grant execute on function public.mark_current_user_support_invite_business_owner_switched() to authenticated;

notify pgrst, 'reload schema';
