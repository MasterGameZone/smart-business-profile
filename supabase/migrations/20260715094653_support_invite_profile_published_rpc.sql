-- Link a Support a Business invitation to a published business profile.
-- This keeps customer_business_supports owner-only while allowing an invited
-- business owner to mark the invitation complete after publishing their own profile.

alter table public.customer_business_supports
  add column if not exists published_profile_id uuid references public.business_profiles(id) on delete set null;

create unique index if not exists customer_business_supports_invitation_token_key
on public.customer_business_supports (invitation_token);

create index if not exists customer_business_supports_published_profile_id_idx
on public.customer_business_supports (published_profile_id);

drop function if exists public.mark_support_invite_profile_published(uuid, uuid);

create function public.mark_support_invite_profile_published(
  p_invitation_token uuid,
  p_profile_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_support public.customer_business_supports%rowtype;
  v_profile_owner_id uuid;
  v_profile_is_public boolean;
begin
  if v_user_id is null then
    raise exception 'Authentication required.' using errcode = '28000';
  end if;

  select owner_id, coalesce(is_public, false)
    into v_profile_owner_id, v_profile_is_public
  from public.business_profiles
  where id = p_profile_id;

  if not found then
    raise exception 'Business profile not found.' using errcode = 'P0002';
  end if;

  if v_profile_owner_id is distinct from v_user_id then
    raise exception 'Business profile is not owned by the current user.' using errcode = '42501';
  end if;

  if not v_profile_is_public then
    raise exception 'Business profile is not published.' using errcode = '42501';
  end if;

  select *
    into v_support
  from public.customer_business_supports
  where invitation_token = p_invitation_token
  for update;

  if not found then
    raise exception 'Support invitation not found.' using errcode = 'P0002';
  end if;

  if v_support.published_profile_id is not null and v_support.published_profile_id <> p_profile_id then
    raise exception 'Support invitation is already linked to another profile.' using errcode = '23505';
  end if;

  if v_support.status = 'Profile Published' and v_support.published_profile_id = p_profile_id then
    return jsonb_build_object('linked', true, 'alreadyLinked', true);
  end if;

  update public.customer_business_supports
  set
    status = 'Profile Published',
    published_profile_id = p_profile_id,
    updated_at = now()
  where id = v_support.id;

  return jsonb_build_object('linked', true, 'alreadyLinked', false);
end;
$$;

revoke all on function public.mark_support_invite_profile_published(uuid, uuid) from public;
grant execute on function public.mark_support_invite_profile_published(uuid, uuid) to authenticated;
