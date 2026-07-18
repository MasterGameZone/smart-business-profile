-- Phase 2 customer/supporter notifications for Shape the Platform participation.
-- Adds notifications for feature votes and submitted feature suggestions.

alter table public.customer_notifications
  drop constraint if exists customer_notifications_type_check,
  add constraint customer_notifications_type_check check (
    type in (
      'supported_business_profile_published',
      'supporter_level_unlocked',
      'support_invite_opened',
      'support_invite_business_signed_up',
      'support_invite_business_owner_switched',
      'feature_vote_recorded',
      'feature_suggestion_submitted',
      'report_status_updated',
      'saved_business_updated'
    )
  );

create unique index if not exists customer_notifications_feature_vote_recorded_unique_idx
on public.customer_notifications (customer_id, type)
where type = 'feature_vote_recorded';

create unique index if not exists customer_notifications_feature_suggestion_submitted_unique_idx
on public.customer_notifications (customer_id, type, related_entity_type, related_entity_id)
where type = 'feature_suggestion_submitted'
  and related_entity_type = 'customer_platform_suggestion';

drop function if exists public.create_customer_feature_vote_recorded_notification(uuid);

create function public.create_customer_feature_vote_recorded_notification(p_feature_vote_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_vote public.customer_feature_votes%rowtype;
begin
  if v_user_id is null then
    return false;
  end if;

  select *
    into v_vote
  from public.customer_feature_votes
  where id = p_feature_vote_id
    and customer_id = v_user_id;

  if not found then
    return false;
  end if;

  insert into public.customer_notifications (
    customer_id,
    type,
    title,
    message,
    action_label,
    action_url,
    related_entity_type,
    related_entity_id,
    is_read,
    read_at,
    created_at
  )
  values (
    v_user_id,
    'feature_vote_recorded',
    'Feature vote recorded',
    'Your vote for ' || v_vote.feature_title || ' has been recorded.',
    'View Shape the Platform',
    '/customer/community#shape',
    'customer_feature_vote',
    v_vote.id,
    false,
    null,
    now()
  )
  on conflict (customer_id, type) where type = 'feature_vote_recorded'
  do update set
    title = excluded.title,
    message = excluded.message,
    action_label = excluded.action_label,
    action_url = excluded.action_url,
    related_entity_type = excluded.related_entity_type,
    related_entity_id = excluded.related_entity_id,
    is_read = false,
    read_at = null,
    created_at = now();

  return true;
end;
$$;

revoke all on function public.create_customer_feature_vote_recorded_notification(uuid) from public;
grant execute on function public.create_customer_feature_vote_recorded_notification(uuid) to authenticated;

drop function if exists public.create_customer_feature_suggestion_submitted_notification(uuid);

create function public.create_customer_feature_suggestion_submitted_notification(p_suggestion_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_suggestion public.customer_platform_suggestions%rowtype;
begin
  if v_user_id is null then
    return false;
  end if;

  select *
    into v_suggestion
  from public.customer_platform_suggestions
  where id = p_suggestion_id
    and customer_id = v_user_id
    and suggestion_type = 'Feature Suggestion';

  if not found then
    return false;
  end if;

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
    v_user_id,
    'feature_suggestion_submitted',
    'Feature suggestion submitted',
    'Your suggestion "' || v_suggestion.title || '" has been submitted.',
    'View Shape the Platform',
    '/customer/community#shape',
    'customer_platform_suggestion',
    v_suggestion.id
  )
  on conflict do nothing;

  return true;
end;
$$;

revoke all on function public.create_customer_feature_suggestion_submitted_notification(uuid) from public;
grant execute on function public.create_customer_feature_suggestion_submitted_notification(uuid) to authenticated;

notify pgrst, 'reload schema';
