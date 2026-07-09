-- Version 4.18 - Report Business Profile
-- Collects user-submitted reports for public business profiles.

create table if not exists public.business_profile_reports (
  id uuid primary key default gen_random_uuid(),
  business_profile_id uuid not null references public.business_profiles (id) on delete cascade,
  reporter_user_id uuid not null references auth.users (id) on delete cascade,
  reason text not null,
  details text,
  status text not null default 'pending',
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint business_profile_reports_reporter_business_key unique (reporter_user_id, business_profile_id),
  constraint business_profile_reports_reason_check check (
    reason in (
      'Fake business',
      'Wrong information',
      'Spam or scam',
      'Inappropriate content',
      'Duplicate profile',
      'Other'
    )
  ),
  constraint business_profile_reports_status_check check (
    status in ('pending', 'reviewed', 'resolved', 'dismissed')
  )
);

create index if not exists business_profile_reports_business_profile_id_idx
on public.business_profile_reports (business_profile_id);

create index if not exists business_profile_reports_reporter_user_id_idx
on public.business_profile_reports (reporter_user_id);

drop trigger if exists set_business_profile_reports_updated_at on public.business_profile_reports;

create trigger set_business_profile_reports_updated_at
before update on public.business_profile_reports
for each row
execute function public.set_updated_at();

alter table public.business_profile_reports enable row level security;

drop policy if exists "Users can read their own business profile reports" on public.business_profile_reports;
create policy "Users can read their own business profile reports"
on public.business_profile_reports
for select
to authenticated
using (reporter_user_id = auth.uid());

drop policy if exists "Users can insert their own business profile reports" on public.business_profile_reports;
create policy "Users can insert their own business profile reports"
on public.business_profile_reports
for insert
to authenticated
with check (
  reporter_user_id = auth.uid()
  and status = 'pending'
  and exists (
    select 1
    from public.business_profiles
    where business_profiles.id = business_profile_reports.business_profile_id
      and business_profiles.is_public is true
  )
);
