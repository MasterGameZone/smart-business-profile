-- Business profile customer actions.
-- Stores intentional public-profile actions for owner-safe aggregate analytics.

create table if not exists public.business_profile_customer_actions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.business_profiles(id) on delete cascade,
  action_type text not null,
  viewer_user_id uuid null references auth.users(id) on delete set null,
  source text not null default 'public_profile',
  created_at timestamp with time zone not null default now(),
  constraint business_profile_customer_actions_action_type_check check (
    action_type in ('call', 'whatsapp', 'directions', 'website')
  ),
  constraint business_profile_customer_actions_source_length check (
    char_length(source) between 1 and 80
  )
);

create index if not exists business_profile_customer_actions_profile_type_created_at_idx
on public.business_profile_customer_actions (profile_id, action_type, created_at desc);

create index if not exists business_profile_customer_actions_profile_created_at_idx
on public.business_profile_customer_actions (profile_id, created_at desc);

create index if not exists business_profile_customer_actions_viewer_user_id_idx
on public.business_profile_customer_actions (viewer_user_id)
where viewer_user_id is not null;

alter table public.business_profile_customer_actions enable row level security;

revoke all on table public.business_profile_customer_actions from anon;
revoke all on table public.business_profile_customer_actions from authenticated;
revoke all on table public.business_profile_customer_actions from public;

create or replace function public.track_business_profile_customer_action(
  target_profile_id uuid,
  target_action_type text,
  event_source text default 'public_profile'
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile_owner_id uuid;
  v_viewer_user_id uuid := (select auth.uid());
  v_action_type text := lower(trim(coalesce(target_action_type, '')));
  v_source text := coalesce(nullif(trim(event_source), ''), 'public_profile');
begin
  if target_profile_id is null
    or v_action_type not in ('call', 'whatsapp', 'directions', 'website')
    or char_length(v_source) > 80 then
    return false;
  end if;

  select business_profiles.owner_id
  into v_profile_owner_id
  from public.business_profiles
  where business_profiles.id = target_profile_id
    and business_profiles.is_public is not false;

  if not found or (v_viewer_user_id is not null and v_profile_owner_id = v_viewer_user_id) then
    return false;
  end if;

  insert into public.business_profile_customer_actions (
    profile_id,
    action_type,
    viewer_user_id,
    source
  )
  values (
    target_profile_id,
    v_action_type,
    v_viewer_user_id,
    v_source
  );

  return true;
end;
$$;

create or replace function public.get_business_profile_action_count(
  target_profile_id uuid,
  target_action_type text
)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select case
    when target_profile_id is null
      or lower(trim(coalesce(target_action_type, ''))) not in ('call', 'whatsapp', 'directions', 'website')
    then 0
    when exists (
      select 1
      from public.business_profiles
      where business_profiles.id = target_profile_id
        and business_profiles.owner_id = (select auth.uid())
    )
    then (
      select count(*)::integer
      from public.business_profile_customer_actions
      where business_profile_customer_actions.profile_id = target_profile_id
        and business_profile_customer_actions.action_type = lower(trim(target_action_type))
    )
    else 0
  end;
$$;

revoke all on function public.track_business_profile_customer_action(uuid, text, text) from public;
revoke all on function public.get_business_profile_action_count(uuid, text) from public;

grant execute on function public.track_business_profile_customer_action(uuid, text, text) to anon;
grant execute on function public.track_business_profile_customer_action(uuid, text, text) to authenticated;
grant execute on function public.get_business_profile_action_count(uuid, text) to authenticated;
