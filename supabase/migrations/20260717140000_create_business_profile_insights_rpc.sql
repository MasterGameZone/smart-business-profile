-- Owner-safe aggregate insights for Business Account analytics.
-- Returns only summarized insight rows; raw analytics rows remain inaccessible.

create or replace function public.get_business_profile_insights(target_profile_id uuid)
returns table (
  insight_type text,
  title text,
  description text,
  highlight text,
  trend text,
  value integer,
  percentage numeric
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_owner_id uuid := (select auth.uid());
  v_total_actions integer := 0;
  v_top_action_label text;
  v_top_action_count integer := 0;
  v_action_percentage numeric := 0;
  v_current_views integer := 0;
  v_previous_views integer := 0;
  v_view_percentage numeric := 0;
  v_new_followers_30d integer := 0;
begin
  if target_profile_id is null or v_owner_id is null then
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

  with action_counts as (
    select
      action_type,
      count(*)::integer as action_count
    from public.business_profile_customer_actions
    where profile_id = target_profile_id
      and action_type in ('call', 'whatsapp', 'directions', 'website')
    group by action_type
  ),
  ranked_actions as (
    select
      action_type,
      action_count,
      sum(action_count) over ()::integer as total_count
    from action_counts
    order by
      action_count desc,
      case action_type
        when 'whatsapp' then 1
        when 'call' then 2
        when 'directions' then 3
        when 'website' then 4
        else 5
      end
    limit 1
  )
  select
    case ranked_actions.action_type
      when 'call' then 'Call'
      when 'whatsapp' then 'WhatsApp'
      when 'directions' then 'Directions'
      when 'website' then 'Website'
      else ''
    end,
    ranked_actions.action_count,
    ranked_actions.total_count
  into
    v_top_action_label,
    v_top_action_count,
    v_total_actions
  from ranked_actions;

  v_total_actions := coalesce(v_total_actions, 0);
  v_top_action_count := coalesce(v_top_action_count, 0);
  v_top_action_label := coalesce(v_top_action_label, '');

  if v_total_actions > 0 then
    v_action_percentage := round((v_top_action_count::numeric / v_total_actions::numeric) * 100, 0);

    return query select
      'most_used_action'::text,
      ('Most used action: ' || v_top_action_label)::text,
      (v_action_percentage::text || '% of total actions came from ' || v_top_action_label || ' clicks.')::text,
      v_top_action_label::text,
      'positive'::text,
      v_top_action_count::integer,
      v_action_percentage::numeric;
  else
    return query select
      'most_used_action'::text,
      'No customer actions yet'::text,
      'Customer action insights will appear after visitors interact with your profile.'::text,
      null::text,
      'neutral'::text,
      0::integer,
      0::numeric;
  end if;

  select count(*)::integer
  into v_current_views
  from public.business_profile_views
  where profile_id = target_profile_id
    and created_at >= now() - interval '7 days'
    and created_at <= now();

  select count(*)::integer
  into v_previous_views
  from public.business_profile_views
  where profile_id = target_profile_id
    and created_at >= now() - interval '14 days'
    and created_at < now() - interval '7 days';

  v_current_views := coalesce(v_current_views, 0);
  v_previous_views := coalesce(v_previous_views, 0);

  if v_previous_views > 0 then
    v_view_percentage := round((abs(v_current_views - v_previous_views)::numeric / v_previous_views::numeric) * 100, 0);
  elsif v_current_views > 0 then
    v_view_percentage := 100;
  else
    v_view_percentage := 0;
  end if;

  if v_current_views > v_previous_views then
    return query select
      'profile_views_weekly'::text,
      'Profile views increased this week'::text,
      ('You had ' || v_view_percentage::text || '% more views compared to last week.')::text,
      (v_view_percentage::text || '%')::text,
      'positive'::text,
      v_current_views::integer,
      v_view_percentage::numeric;
  elsif v_current_views < v_previous_views then
    return query select
      'profile_views_weekly'::text,
      'Profile views decreased this week'::text,
      ('You had ' || v_view_percentage::text || '% fewer views compared to last week.')::text,
      (v_view_percentage::text || '%')::text,
      'negative'::text,
      v_current_views::integer,
      v_view_percentage::numeric;
  elsif v_current_views > 0 then
    return query select
      'profile_views_weekly'::text,
      'Profile views stayed steady'::text,
      'Your profile views matched last week''s activity.'::text,
      null::text,
      'neutral'::text,
      v_current_views::integer,
      0::numeric;
  else
    return query select
      'profile_views_weekly'::text,
      'No profile views this week'::text,
      'Share your profile link to start getting visitor activity.'::text,
      null::text,
      'neutral'::text,
      0::integer,
      0::numeric;
  end if;

  select count(*)::integer
  into v_new_followers_30d
  from public.business_profile_followers
  where profile_id = target_profile_id
    and created_at >= now() - interval '30 days';

  v_new_followers_30d := coalesce(v_new_followers_30d, 0);

  if v_new_followers_30d > 0 then
    return query select
      'followers_30d'::text,
      'Followers grew steadily this month'::text,
      ('You gained ' || v_new_followers_30d::text || ' new followers in the last 30 days.')::text,
      v_new_followers_30d::text,
      'positive'::text,
      v_new_followers_30d::integer,
      0::numeric;
  else
    return query select
      'followers_30d'::text,
      'No new followers this month'::text,
      'Share your profile to grow your follower base.'::text,
      null::text,
      'neutral'::text,
      0::integer,
      0::numeric;
  end if;
end;
$$;

revoke all on function public.get_business_profile_insights(uuid) from public;
revoke all on function public.get_business_profile_insights(uuid) from anon;
revoke all on function public.get_business_profile_insights(uuid) from authenticated;

grant execute on function public.get_business_profile_insights(uuid) to authenticated;
