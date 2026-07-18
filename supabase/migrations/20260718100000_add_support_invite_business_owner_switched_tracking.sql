-- Track when an invited owner enters Business Owner mode after claiming a support invite.

alter table public.customer_business_supports
  add column if not exists business_owner_switched_at timestamp with time zone;

create index if not exists customer_business_supports_business_owner_switched_at_idx
on public.customer_business_supports (business_owner_switched_at);

alter table public.customer_business_supports
  drop constraint if exists customer_business_supports_status_check,
  add constraint customer_business_supports_status_check check (
    status in (
      'Nominated',
      'Invitation Shared',
      'Business Signed Up',
      'Switched to Business Owner',
      'Profile Published'
    )
  );

drop function if exists public.mark_support_invite_business_owner_switched(text);

create function public.mark_support_invite_business_owner_switched(invite_token text)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_invitation_token uuid;
  v_support public.customer_business_supports%rowtype;
begin
  if v_user_id is null then
    return false;
  end if;

  if invite_token is null or btrim(invite_token) = '' then
    return false;
  end if;

  begin
    v_invitation_token := btrim(invite_token)::uuid;
  exception
    when invalid_text_representation then
      return false;
  end;

  select *
    into v_support
  from public.customer_business_supports
  where invitation_token = v_invitation_token
  for update;

  if not found then
    return false;
  end if;

  if v_support.invited_owner_user_id is distinct from v_user_id then
    return false;
  end if;

  update public.customer_business_supports
  set
    business_owner_switched_at = coalesce(business_owner_switched_at, now()),
    status = case
      when status = 'Profile Published' then status
      else 'Switched to Business Owner'
    end,
    updated_at = now()
  where id = v_support.id;

  return true;
end;
$$;

revoke all on function public.mark_support_invite_business_owner_switched(text) from public;
grant execute on function public.mark_support_invite_business_owner_switched(text) to authenticated;

notify pgrst, 'reload schema';
