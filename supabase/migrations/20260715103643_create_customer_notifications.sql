-- Customer notifications MVP.
-- Stores private customer-owned notifications and creates profile-published
-- notifications from the secure support invite linking RPC.

create table if not exists public.customer_notifications (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references auth.users(id) on delete cascade,
  type text not null,
  title text not null,
  message text not null,
  action_label text,
  action_url text,
  related_entity_type text,
  related_entity_id uuid,
  is_read boolean not null default false,
  read_at timestamp with time zone,
  created_at timestamp with time zone not null default now(),
  constraint customer_notifications_type_check check (
    type in (
      'supported_business_profile_published',
      'supporter_level_unlocked',
      'report_status_updated',
      'saved_business_updated'
    )
  )
);

create index if not exists customer_notifications_customer_created_at_idx
on public.customer_notifications (customer_id, created_at desc);

create unique index if not exists customer_notifications_profile_published_unique_idx
on public.customer_notifications (customer_id, type, related_entity_type, related_entity_id)
where type = 'supported_business_profile_published'
  and related_entity_type = 'customer_business_support';

create unique index if not exists customer_notifications_supporter_level_unique_idx
on public.customer_notifications (customer_id, type, title)
where type = 'supporter_level_unlocked';

alter table public.customer_notifications enable row level security;

revoke all on table public.customer_notifications from anon;
revoke all on table public.customer_notifications from public;
grant select on table public.customer_notifications to authenticated;
grant update (is_read, read_at) on table public.customer_notifications to authenticated;

drop policy if exists "Customers can read their own notifications" on public.customer_notifications;
create policy "Customers can read their own notifications"
on public.customer_notifications
for select
to authenticated
using ((select auth.uid()) = customer_id);

drop policy if exists "Customers can mark their own notifications read" on public.customer_notifications;
create policy "Customers can mark their own notifications read"
on public.customer_notifications
for update
to authenticated
using ((select auth.uid()) = customer_id)
with check ((select auth.uid()) = customer_id);

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
  v_profile_business_name text;
  v_profile_slug text;
  v_business_name text;
  v_supports_count integer;
  v_unlocked_level text;
begin
  if v_user_id is null then
    raise exception 'Authentication required.' using errcode = '28000';
  end if;

  select owner_id, coalesce(is_public, false), business_name, slug
    into v_profile_owner_id, v_profile_is_public, v_profile_business_name, v_profile_slug
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

  v_business_name := coalesce(nullif(v_profile_business_name, ''), v_support.business_name, 'A supported business');

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
    'supported_business_profile_published',
    v_business_name || ' published its profile.',
    'Your support helped this business go digital.',
    'View Profile',
    case when v_profile_slug is not null and v_profile_slug <> '' then '/business/' || v_profile_slug else null end,
    'customer_business_support',
    v_support.id
  )
  on conflict do nothing;

  select count(*)
    into v_supports_count
  from public.customer_business_supports
  where customer_id = v_support.customer_id;

  v_unlocked_level := case
    when v_supports_count >= 6 then 'Local Champion'
    when v_supports_count >= 3 then 'Community Builder'
    when v_supports_count >= 1 then 'Local Supporter'
    else null
  end;

  if v_unlocked_level is not null then
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
      'supporter_level_unlocked',
      'You unlocked ' || v_unlocked_level || '.',
      case
        when v_unlocked_level = 'Local Supporter' then 'Your first supported business has published its profile.'
        else 'Your supported businesses are growing your local impact.'
      end,
      'View My Local Impact',
      '/customer/community#impact',
      'customer_business_support',
      v_support.id
    )
    on conflict do nothing;
  end if;

  return jsonb_build_object('linked', true, 'alreadyLinked', false);
end;
$$;

revoke all on function public.mark_support_invite_profile_published(uuid, uuid) from public;
grant execute on function public.mark_support_invite_profile_published(uuid, uuid) to authenticated;
