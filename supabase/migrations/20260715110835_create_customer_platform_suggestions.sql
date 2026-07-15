-- Customer Shape the Platform MVP.
-- Stores private customer feature votes and customer-owned platform suggestions.

create table if not exists public.customer_feature_votes (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references auth.users(id) on delete cascade,
  feature_key text not null,
  feature_title text not null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint customer_feature_votes_customer_feature_key unique (customer_id, feature_key),
  constraint customer_feature_votes_feature_key_check check (
    feature_key in (
      'appointment_booking',
      'offers_vouchers',
      'verified_business_badge',
      'advanced_directory_search',
      'business_enquiry_forms'
    )
  ),
  constraint customer_feature_votes_feature_title_length check (
    char_length(btrim(feature_title)) between 1 and 80
  )
);

create index if not exists customer_feature_votes_customer_created_at_idx
on public.customer_feature_votes (customer_id, created_at desc);

alter table public.customer_feature_votes enable row level security;

revoke all on table public.customer_feature_votes from anon;
revoke all on table public.customer_feature_votes from public;
grant select, insert, delete on table public.customer_feature_votes to authenticated;

drop policy if exists "Customers can read their own feature votes" on public.customer_feature_votes;
create policy "Customers can read their own feature votes"
on public.customer_feature_votes
for select
to authenticated
using ((select auth.uid()) = customer_id);

drop policy if exists "Customers can insert their own feature votes" on public.customer_feature_votes;
create policy "Customers can insert their own feature votes"
on public.customer_feature_votes
for insert
to authenticated
with check ((select auth.uid()) = customer_id);

drop policy if exists "Customers can delete their own feature votes" on public.customer_feature_votes;
create policy "Customers can delete their own feature votes"
on public.customer_feature_votes
for delete
to authenticated
using ((select auth.uid()) = customer_id);

drop trigger if exists set_customer_feature_votes_updated_at on public.customer_feature_votes;
create trigger set_customer_feature_votes_updated_at
before update on public.customer_feature_votes
for each row
execute function public.set_updated_at();

create table if not exists public.customer_platform_suggestions (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references auth.users(id) on delete cascade,
  suggestion_type text not null,
  title text not null,
  message text not null,
  status text not null default 'Submitted',
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint customer_platform_suggestions_type_check check (
    suggestion_type in (
      'Feature Suggestion',
      'Category Suggestion',
      'Platform Improvement'
    )
  ),
  constraint customer_platform_suggestions_status_check check (
    status in (
      'Submitted',
      'Under Review',
      'Planned',
      'Added',
      'Declined'
    )
  ),
  constraint customer_platform_suggestions_title_length check (
    char_length(btrim(title)) between 1 and 80
  ),
  constraint customer_platform_suggestions_message_length check (
    char_length(btrim(message)) between 1 and 500
  ),
  constraint customer_platform_suggestions_title_no_links check (
    title !~* '(https?://|www\.|[a-z0-9-]+\.[a-z]{2,})'
  ),
  constraint customer_platform_suggestions_message_no_links check (
    message !~* '(https?://|www\.|[a-z0-9-]+\.[a-z]{2,})'
  )
);

create index if not exists customer_platform_suggestions_customer_created_at_idx
on public.customer_platform_suggestions (customer_id, created_at desc);

alter table public.customer_platform_suggestions enable row level security;

revoke all on table public.customer_platform_suggestions from anon;
revoke all on table public.customer_platform_suggestions from public;
grant select, insert on table public.customer_platform_suggestions to authenticated;

drop policy if exists "Customers can read their own platform suggestions" on public.customer_platform_suggestions;
create policy "Customers can read their own platform suggestions"
on public.customer_platform_suggestions
for select
to authenticated
using ((select auth.uid()) = customer_id);

drop policy if exists "Customers can insert their own platform suggestions" on public.customer_platform_suggestions;
create policy "Customers can insert their own platform suggestions"
on public.customer_platform_suggestions
for insert
to authenticated
with check (
  (select auth.uid()) = customer_id
  and status = 'Submitted'
);

drop trigger if exists set_customer_platform_suggestions_updated_at on public.customer_platform_suggestions;
create trigger set_customer_platform_suggestions_updated_at
before update on public.customer_platform_suggestions
for each row
execute function public.set_updated_at();
