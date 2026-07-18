-- Phase 1 customer/supporter notifications for support-invite journey milestones.
-- Creates one notification per customer support row for invite opened, business
-- signed up, and Business Owner mode enabled milestones.

alter table public.customer_notifications
  drop constraint if exists customer_notifications_type_check,
  add constraint customer_notifications_type_check check (
    type in (
      'supported_business_profile_published',
      'supporter_level_unlocked',
      'support_invite_opened',
      'support_invite_business_signed_up',
      'support_invite_business_owner_switched',
      'report_status_updated',
      'saved_business_updated'
    )
  );

create unique index if not exists customer_notifications_support_journey_unique_idx
on public.customer_notifications (customer_id, type, related_entity_type, related_entity_id)
where type in (
    'support_invite_opened',
    'support_invite_business_signed_up',
    'support_invite_business_owner_switched'
  )
  and related_entity_type = 'customer_business_support';

drop function if exists public.mark_support_invite_opened(text);

create function public.mark_support_invite_opened(invite_token text)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_invitation_token uuid;
  v_support public.customer_business_supports%rowtype;
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

  select *
    into v_support
  from public.customer_business_supports
  where invitation_token = v_invitation_token
  for update;

  if not found then
    return false;
  end if;

  update public.customer_business_supports
  set
    invitation_opened_at = coalesce(invitation_opened_at, now()),
    invitation_open_count = invitation_open_count + 1,
    updated_at = now()
  where id = v_support.id;

  if v_support.invitation_opened_at is null then
    insert into public.customer_notifications (
      customer_id,
      type,
      title,
      message,
      action_label,
      action_url,
      related_entity_type,
      related_entity_id
    )
    values (
      v_support.customer_id,
      'support_invite_opened',
      'Invitation link opened',
      coalesce(nullif(v_support.business_name, ''), 'A supported business') || ' opened your invitation link.',
      'View My Local Impact',
      '/customer/community#impact',
      'customer_business_support',
      v_support.id
    )
    on conflict do nothing;
  end if;

  return true;
end;
$$;

revoke all on function public.mark_support_invite_opened(text) from public;
grant execute on function public.mark_support_invite_opened(text) to anon;
grant execute on function public.mark_support_invite_opened(text) to authenticated;

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
      when status in ('Switched to Business Owner', 'Profile Published') then status
      else 'Business Signed Up'
    end,
    updated_at = now()
  where id = v_support.id;

  if v_support.business_signed_up_at is null then
    insert into public.customer_notifications (
      customer_id,
      type,
      title,
      message,
      action_label,
      action_url,
      related_entity_type,
      related_entity_id
    )
    values (
      v_support.customer_id,
      'support_invite_business_signed_up',
      'Business signed up',
      coalesce(nullif(v_support.business_name, ''), 'A supported business') || ' signed up from your invitation.',
      'View My Local Impact',
      '/customer/community#impact',
      'customer_business_support',
      v_support.id
    )
    on conflict do nothing;
  end if;

  return true;
end;
$$;

revoke all on function public.mark_support_invite_business_signed_up(text) from public;
grant execute on function public.mark_support_invite_business_signed_up(text) to authenticated;

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

  if v_support.business_owner_switched_at is null
    and v_support.published_profile_id is null
    and v_support.status <> 'Profile Published'
  then
    insert into public.customer_notifications (
      customer_id,
      type,
      title,
      message,
      action_label,
      action_url,
      related_entity_type,
      related_entity_id
    )
    values (
      v_support.customer_id,
      'support_invite_business_owner_switched',
      'Business Owner mode enabled',
      coalesce(nullif(v_support.business_name, ''), 'A supported business') || ' switched to Business Owner mode.',
      'View My Local Impact',
      '/customer/community#impact',
      'customer_business_support',
      v_support.id
    )
    on conflict do nothing;
  end if;

  return true;
end;
$$;

revoke all on function public.mark_support_invite_business_owner_switched(text) from public;
grant execute on function public.mark_support_invite_business_owner_switched(text) to authenticated;

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
  v_support public.customer_business_supports%rowtype;
begin
  if v_user_id is null then
    return false;
  end if;

  for v_support in
    select *
    from public.customer_business_supports
    where invited_owner_user_id = v_user_id
      and business_signed_up_at is not null
      and business_owner_switched_at is null
      and published_profile_id is null
      and status <> 'Profile Published'
    for update
  loop
    update public.customer_business_supports
    set
      business_owner_switched_at = now(),
      status = 'Switched to Business Owner',
      updated_at = now()
    where id = v_support.id;

    v_updated_count := v_updated_count + 1;

    insert into public.customer_notifications (
      customer_id,
      type,
      title,
      message,
      action_label,
      action_url,
      related_entity_type,
      related_entity_id
    )
    values (
      v_support.customer_id,
      'support_invite_business_owner_switched',
      'Business Owner mode enabled',
      coalesce(nullif(v_support.business_name, ''), 'A supported business') || ' switched to Business Owner mode.',
      'View My Local Impact',
      '/customer/community#impact',
      'customer_business_support',
      v_support.id
    )
    on conflict do nothing;
  end loop;

  return v_updated_count > 0;
end;
$$;

revoke all on function public.mark_current_user_support_invite_business_owner_switched() from public;
grant execute on function public.mark_current_user_support_invite_business_owner_switched() to authenticated;

notify pgrst, 'reload schema';
