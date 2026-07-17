-- Public-safe preview for Support a Business invite landing pages.
-- Returns only the inviter display name for a matching invitation token.

drop function if exists public.get_support_invite_preview(text);

create function public.get_support_invite_preview(invite_token text)
returns table (
  customer_name text
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_invitation_token uuid;
begin
  if invite_token is null or btrim(invite_token) = '' then
    return;
  end if;

  begin
    v_invitation_token := btrim(invite_token)::uuid;
  exception
    when invalid_text_representation then
      return;
  end;

  return query
  select nullif(btrim(customer_profiles.customer_name), '') as customer_name
  from public.customer_business_supports
  left join public.customer_profiles
    on customer_profiles.user_id = customer_business_supports.customer_id
  where customer_business_supports.invitation_token = v_invitation_token
  limit 1;
end;
$$;

revoke all on function public.get_support_invite_preview(text) from public;
grant execute on function public.get_support_invite_preview(text) to anon;
grant execute on function public.get_support_invite_preview(text) to authenticated;

notify pgrst, 'reload schema';
