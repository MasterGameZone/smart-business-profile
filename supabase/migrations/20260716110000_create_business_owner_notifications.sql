-- Business Owner notifications MVP.
-- Stores private business-owner notifications without mixing customer notifications.

create table if not exists public.business_owner_notifications (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  type text not null,
  title text not null,
  message text not null,
  action_label text,
  action_url text,
  related_entity_type text,
  related_entity_id uuid,
  dedupe_key text,
  is_read boolean not null default false,
  read_at timestamp with time zone,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint business_owner_notifications_type_check check (
    type in (
      'profile_update_reminder',
      'support_help_reply',
      'review_report_update',
      'subscription_payment_update'
    )
  )
);

create index if not exists business_owner_notifications_owner_created_at_idx
on public.business_owner_notifications (owner_id, created_at desc);

create unique index if not exists business_owner_notifications_dedupe_unique_idx
on public.business_owner_notifications (owner_id, type, dedupe_key)
where dedupe_key is not null;

alter table public.business_owner_notifications enable row level security;

revoke all on table public.business_owner_notifications from anon;
revoke all on table public.business_owner_notifications from public;
grant select, insert on table public.business_owner_notifications to authenticated;
grant update (is_read, read_at) on table public.business_owner_notifications to authenticated;

drop policy if exists "Business owners can read their own notifications" on public.business_owner_notifications;
create policy "Business owners can read their own notifications"
on public.business_owner_notifications
for select
to authenticated
using ((select auth.uid()) = owner_id);

drop policy if exists "Business owners can create their own notifications" on public.business_owner_notifications;
create policy "Business owners can create their own notifications"
on public.business_owner_notifications
for insert
to authenticated
with check ((select auth.uid()) = owner_id);

drop policy if exists "Business owners can mark their own notifications read" on public.business_owner_notifications;
create policy "Business owners can mark their own notifications read"
on public.business_owner_notifications
for update
to authenticated
using ((select auth.uid()) = owner_id)
with check ((select auth.uid()) = owner_id);

drop trigger if exists set_business_owner_notifications_updated_at on public.business_owner_notifications;
create trigger set_business_owner_notifications_updated_at
before update on public.business_owner_notifications
for each row
execute function public.set_updated_at();
