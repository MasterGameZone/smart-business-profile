-- Phase 3 customer/supporter notifications for Benefits and supporter-only announcements.
-- Adds a published-announcement foundation and syncs each published announcement
-- into a customer's private notifications once per user.

create table if not exists public.supporter_program_announcements (
  id uuid primary key default gen_random_uuid(),
  announcement_type text not null,
  benefit_key text,
  benefit_name text,
  old_status text,
  new_status text,
  title text not null,
  message text not null,
  action_target text,
  is_published boolean not null default false,
  published_at timestamp with time zone,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint supporter_program_announcements_type_check check (
    announcement_type in (
      'new_benefit_announced',
      'benefit_status_updated',
      'supporter_only_announcement'
    )
  ),
  constraint supporter_program_announcements_old_status_check check (
    old_status is null or old_status in (
      'Active / Improving',
      'Planned',
      'Coming Soon',
      'Under Review'
    )
  ),
  constraint supporter_program_announcements_new_status_check check (
    new_status is null or new_status in (
      'Active / Improving',
      'Planned',
      'Coming Soon',
      'Under Review'
    )
  )
);

create index if not exists supporter_program_announcements_published_idx
on public.supporter_program_announcements (published_at desc)
where is_published = true
  and published_at is not null;

drop trigger if exists set_supporter_program_announcements_updated_at on public.supporter_program_announcements;
create trigger set_supporter_program_announcements_updated_at
before update on public.supporter_program_announcements
for each row
execute function public.set_updated_at();

alter table public.supporter_program_announcements enable row level security;

revoke all on table public.supporter_program_announcements from anon;
revoke all on table public.supporter_program_announcements from public;
grant select on table public.supporter_program_announcements to authenticated;

drop policy if exists "Authenticated users can read published supporter programme announcements" on public.supporter_program_announcements;
create policy "Authenticated users can read published supporter programme announcements"
on public.supporter_program_announcements
for select
to authenticated
using (
  is_published = true
  and published_at is not null
  and published_at <= now()
);

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
      'new_benefit_announced',
      'benefit_status_updated',
      'supporter_only_announcement',
      'report_status_updated',
      'saved_business_updated'
    )
  );

create unique index if not exists customer_notifications_supporter_program_announcement_unique_idx
on public.customer_notifications (customer_id, type, related_entity_type, related_entity_id)
where type in (
    'new_benefit_announced',
    'benefit_status_updated',
    'supporter_only_announcement'
  )
  and related_entity_type = 'supporter_program_announcement';

drop function if exists public.sync_supporter_program_announcement_notifications();

create function public.sync_supporter_program_announcement_notifications()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_inserted_count integer := 0;
begin
  if v_user_id is null then
    raise exception 'Authentication required.' using errcode = '28000';
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
    created_at
  )
  select
    v_user_id,
    announcement.announcement_type,
    announcement.title,
    announcement.message,
    case
      when announcement.announcement_type in ('new_benefit_announced', 'benefit_status_updated') then 'View Benefit'
      else 'View Community'
    end,
    case
      when announcement.announcement_type in ('new_benefit_announced', 'benefit_status_updated') then '/customer/community#benefit'
      when announcement.action_target in ('benefit', 'community_benefit', '/customer/community#benefit') then '/customer/community#benefit'
      when announcement.action_target in ('impact', 'community_impact', '/customer/community#impact') then '/customer/community#impact'
      when announcement.action_target in ('support', 'community_support', '/customer/community#support') then '/customer/community#support'
      when announcement.action_target in ('shape', 'community_shape', '/customer/community#shape') then '/customer/community#shape'
      else '/customer/community'
    end,
    'supporter_program_announcement',
    announcement.id,
    coalesce(announcement.published_at, now())
  from public.supporter_program_announcements as announcement
  where announcement.is_published = true
    and announcement.published_at is not null
    and announcement.published_at <= now()
  on conflict do nothing;

  get diagnostics v_inserted_count = row_count;

  return jsonb_build_object('syncedCount', v_inserted_count);
end;
$$;

revoke all on function public.sync_supporter_program_announcement_notifications() from public;
grant execute on function public.sync_supporter_program_announcement_notifications() to authenticated;

notify pgrst, 'reload schema';
