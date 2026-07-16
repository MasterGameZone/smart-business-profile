-- Owner-safe aggregate profile view activity for Business Account analytics.
-- Returns grouped counts only; individual profile view rows remain inaccessible.

create or replace function public.get_business_profile_view_activity(
  target_profile_id uuid,
  activity_interval text
)
returns table (
  label text,
  value integer
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_interval text := lower(trim(coalesce(activity_interval, '')));
  v_owner_id uuid := (select auth.uid());
begin
  if target_profile_id is null or v_owner_id is null then
    return;
  end if;

  if v_interval not in ('daily', 'weekly', 'monthly') then
    return;
  end if;

  if not exists (
    select 1
    from public.business_profiles
    where business_profiles.id = target_profile_id
      and business_profiles.owner_id = v_owner_id
  ) then
    return;
  end if;

  if v_interval = 'daily' then
    return query
    with buckets as (
      select generate_series(
        date_trunc('day', timezone('UTC', now())) - interval '6 days',
        date_trunc('day', timezone('UTC', now())),
        interval '1 day'
      ) as bucket_start
    ),
    view_counts as (
      select
        date_trunc('day', timezone('UTC', business_profile_views.created_at)) as bucket_start,
        count(*)::integer as view_count
      from public.business_profile_views
      where business_profile_views.profile_id = target_profile_id
        and business_profile_views.created_at >= (
          date_trunc('day', timezone('UTC', now())) - interval '6 days'
        ) at time zone 'UTC'
      group by 1
    )
    select
      to_char(buckets.bucket_start, 'Mon FMDD')::text as label,
      coalesce(view_counts.view_count, 0)::integer as value
    from buckets
    left join view_counts on view_counts.bucket_start = buckets.bucket_start
    order by buckets.bucket_start;

    return;
  end if;

  if v_interval = 'weekly' then
    return query
    with buckets as (
      select generate_series(
        date_trunc('week', timezone('UTC', now())) - interval '5 weeks',
        date_trunc('week', timezone('UTC', now())),
        interval '1 week'
      ) as bucket_start
    ),
    view_counts as (
      select
        date_trunc('week', timezone('UTC', business_profile_views.created_at)) as bucket_start,
        count(*)::integer as view_count
      from public.business_profile_views
      where business_profile_views.profile_id = target_profile_id
        and business_profile_views.created_at >= (
          date_trunc('week', timezone('UTC', now())) - interval '5 weeks'
        ) at time zone 'UTC'
      group by 1
    )
    select
      ('Week ' || row_number() over (order by buckets.bucket_start))::text as label,
      coalesce(view_counts.view_count, 0)::integer as value
    from buckets
    left join view_counts on view_counts.bucket_start = buckets.bucket_start
    order by buckets.bucket_start;

    return;
  end if;

  if v_interval = 'monthly' then
    return query
    with buckets as (
      select generate_series(
        date_trunc('month', timezone('UTC', now())) - interval '5 months',
        date_trunc('month', timezone('UTC', now())),
        interval '1 month'
      ) as bucket_start
    ),
    view_counts as (
      select
        date_trunc('month', timezone('UTC', business_profile_views.created_at)) as bucket_start,
        count(*)::integer as view_count
      from public.business_profile_views
      where business_profile_views.profile_id = target_profile_id
        and business_profile_views.created_at >= (
          date_trunc('month', timezone('UTC', now())) - interval '5 months'
        ) at time zone 'UTC'
      group by 1
    )
    select
      to_char(buckets.bucket_start, 'Mon')::text as label,
      coalesce(view_counts.view_count, 0)::integer as value
    from buckets
    left join view_counts on view_counts.bucket_start = buckets.bucket_start
    order by buckets.bucket_start;
  end if;
end;
$$;

revoke all on function public.get_business_profile_view_activity(uuid, text) from public;
revoke all on function public.get_business_profile_view_activity(uuid, text) from anon;
revoke all on function public.get_business_profile_view_activity(uuid, text) from authenticated;

grant execute on function public.get_business_profile_view_activity(uuid, text) to authenticated;
