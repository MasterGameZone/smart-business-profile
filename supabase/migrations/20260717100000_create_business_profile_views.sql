-- Business profile views.
-- Records public profile views with one counted view per visitor/profile
-- in each fixed UTC 12-hour window: 00:00-11:59 or 12:00-23:59.

create extension if not exists "pgcrypto" with schema extensions;

create table if not exists public.business_profile_views (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.business_profiles(id) on delete cascade,
  viewer_user_id uuid null references auth.users(id) on delete set null,
  visitor_key_hash text not null,
  view_window_start timestamp with time zone not null,
  source text not null default 'public_profile',
  created_at timestamp with time zone not null default now(),
  constraint business_profile_views_profile_visitor_window_unique unique (
    profile_id,
    visitor_key_hash,
    view_window_start
  ),
  constraint business_profile_views_source_length check (char_length(source) between 1 and 80)
);

create index if not exists business_profile_views_profile_id_created_at_idx
on public.business_profile_views (profile_id, created_at desc);

create index if not exists business_profile_views_profile_id_window_idx
on public.business_profile_views (profile_id, view_window_start);

create index if not exists business_profile_views_viewer_user_id_idx
on public.business_profile_views (viewer_user_id)
where viewer_user_id is not null;

alter table public.business_profile_views enable row level security;

revoke all on table public.business_profile_views from anon;
revoke all on table public.business_profile_views from authenticated;
revoke all on table public.business_profile_views from public;

create or replace function public.current_utc_12_hour_window_start()
returns timestamp with time zone
language sql
stable
set search_path = public
as $$
  select (
    date_trunc('day', timezone('UTC', now())) +
    case
      when extract(hour from timezone('UTC', now())) >= 12 then interval '12 hours'
      else interval '0 hours'
    end
  ) at time zone 'UTC';
$$;

create or replace function public.track_business_profile_view(
  target_profile_id uuid,
  visitor_key text,
  source text default 'public_profile'
)
returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_profile_owner_id uuid;
  v_viewer_user_id uuid := (select auth.uid());
  v_visitor_identity text;
  v_visitor_key_hash text;
  v_source text := coalesce(nullif(trim(source), ''), 'public_profile');
  v_inserted integer;
begin
  select business_profiles.owner_id
  into v_profile_owner_id
  from public.business_profiles
  where business_profiles.id = target_profile_id
    and business_profiles.is_public is not false;

  if v_profile_owner_id is null and not exists (
    select 1
    from public.business_profiles
    where business_profiles.id = target_profile_id
      and business_profiles.is_public is not false
  ) then
    return false;
  end if;

  if v_viewer_user_id is not null and v_profile_owner_id = v_viewer_user_id then
    return false;
  end if;

  if v_viewer_user_id is not null then
    v_visitor_identity := 'user:' || v_viewer_user_id::text;
  else
    if visitor_key is null or trim(visitor_key) = '' then
      return false;
    end if;

    v_visitor_identity := 'visitor:' || trim(visitor_key);
  end if;

  v_visitor_key_hash := encode(digest(v_visitor_identity, 'sha256'), 'hex');

  insert into public.business_profile_views (
    profile_id,
    viewer_user_id,
    visitor_key_hash,
    view_window_start,
    source
  )
  values (
    target_profile_id,
    v_viewer_user_id,
    v_visitor_key_hash,
    public.current_utc_12_hour_window_start(),
    left(v_source, 80)
  )
  on conflict (profile_id, visitor_key_hash, view_window_start) do nothing
  returning 1 into v_inserted;

  return coalesce(v_inserted, 0) = 1;
end;
$$;

create or replace function public.get_business_profile_views_count(target_profile_id uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select case
    when exists (
      select 1
      from public.business_profiles
      where business_profiles.id = target_profile_id
        and business_profiles.owner_id = (select auth.uid())
    )
    then (
      select count(*)::integer
      from public.business_profile_views
      where business_profile_views.profile_id = target_profile_id
    )
    else 0
  end;
$$;

revoke all on function public.current_utc_12_hour_window_start() from public;
revoke all on function public.track_business_profile_view(uuid, text, text) from public;
revoke all on function public.get_business_profile_views_count(uuid) from public;

grant execute on function public.track_business_profile_view(uuid, text, text) to anon;
grant execute on function public.track_business_profile_view(uuid, text, text) to authenticated;
grant execute on function public.get_business_profile_views_count(uuid) to authenticated;
