-- Track when a support invitation is claimed by an authenticated business owner account.

alter table public.customer_business_supports
  add column if not exists invited_owner_user_id uuid references auth.users(id) on delete set null,
  add column if not exists business_signed_up_at timestamp with time zone;

create index if not exists customer_business_supports_invited_owner_user_id_idx
on public.customer_business_supports (invited_owner_user_id);

create index if not exists customer_business_supports_business_signed_up_at_idx
on public.customer_business_supports (business_signed_up_at);

alter table public.customer_business_supports
  drop constraint if exists customer_business_supports_status_check,
  add constraint customer_business_supports_status_check check (
    status in ('Nominated', 'Invitation Shared', 'Business Signed Up', 'Profile Published')
  );

drop function if exists public.mark_support_invite_business_signed_up(text);

create function public.mark_support_invite_business_signed_up(invite_token text)
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

  if v_support.invited_owner_user_id is not null and v_support.invited_owner_user_id is distinct from v_user_id then
    return false;
  end if;

  update public.customer_business_supports
  set
    invited_owner_user_id = coalesce(invited_owner_user_id, v_user_id),
    business_signed_up_at = coalesce(business_signed_up_at, now()),
    status = case
      when status = 'Profile Published' then status
      else 'Business Signed Up'
    end,
    updated_at = now()
  where id = v_support.id;

  return true;
end;
$$;

revoke all on function public.mark_support_invite_business_signed_up(text) from public;
grant execute on function public.mark_support_invite_business_signed_up(text) to authenticated;

notify pgrst, 'reload schema';
