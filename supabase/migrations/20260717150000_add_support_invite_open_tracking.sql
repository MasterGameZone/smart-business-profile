-- Track public opens of Support a Business invitation links.
-- Keeps customer_business_supports owner-only while allowing anonymous invite
-- link opens to update only the row matching the invitation token.

alter table public.customer_business_supports
  add column if not exists invitation_opened_at timestamp with time zone,
  add column if not exists invitation_open_count integer not null default 0;

alter table public.customer_business_supports
  drop constraint if exists customer_business_supports_invitation_open_count_nonnegative,
  add constraint customer_business_supports_invitation_open_count_nonnegative
    check (invitation_open_count >= 0);

drop function if exists public.mark_support_invite_opened(text);

create function public.mark_support_invite_opened(invite_token text)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_invitation_token uuid;
begin
  if invite_token is null or btrim(invite_token) = '' then
    return false;
  end if;

  begin
    v_invitation_token := btrim(invite_token)::uuid;
  exception
    when invalid_text_representation then
      return false;
  end;

  update public.customer_business_supports
  set
    invitation_opened_at = coalesce(invitation_opened_at, now()),
    invitation_open_count = invitation_open_count + 1,
    updated_at = now()
  where invitation_token = v_invitation_token;

  return found;
end;
$$;

revoke all on function public.mark_support_invite_opened(text) from public;
grant execute on function public.mark_support_invite_opened(text) to anon;
grant execute on function public.mark_support_invite_opened(text) to authenticated;

notify pgrst, 'reload schema';
