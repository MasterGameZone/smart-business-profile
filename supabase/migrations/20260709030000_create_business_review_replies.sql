-- Version 4.19 - Business Owner Review Replies
-- Adds one public owner response per review with owner-only write access.

create table if not exists public.business_review_replies (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null references public.business_reviews (id) on delete cascade,
  business_profile_id uuid not null references public.business_profiles (id) on delete cascade,
  owner_user_id uuid not null references auth.users (id) on delete cascade,
  reply_text text not null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint business_review_replies_review_id_key unique (review_id),
  constraint business_review_replies_reply_text_check check (length(trim(reply_text)) > 0)
);

create index if not exists business_review_replies_review_id_idx
on public.business_review_replies (review_id);

create index if not exists business_review_replies_business_profile_id_idx
on public.business_review_replies (business_profile_id);

create index if not exists business_review_replies_owner_user_id_idx
on public.business_review_replies (owner_user_id);

drop trigger if exists set_business_review_replies_updated_at on public.business_review_replies;

create trigger set_business_review_replies_updated_at
before update on public.business_review_replies
for each row
execute function public.set_updated_at();

alter table public.business_review_replies enable row level security;

drop policy if exists "Public can read replies for public review profiles" on public.business_review_replies;
create policy "Public can read replies for public review profiles"
on public.business_review_replies
for select
to anon, authenticated
using (
  exists (
    select 1
    from public.business_profiles
    where business_profiles.id = business_review_replies.business_profile_id
      and business_profiles.is_public is true
  )
);

drop policy if exists "Owners can insert replies for their business reviews" on public.business_review_replies;
create policy "Owners can insert replies for their business reviews"
on public.business_review_replies
for insert
to authenticated
with check (
  owner_user_id = auth.uid()
  and exists (
    select 1
    from public.business_profiles
    where business_profiles.id = business_review_replies.business_profile_id
      and business_profiles.owner_id = auth.uid()
  )
  and exists (
    select 1
    from public.business_reviews
    where business_reviews.id = business_review_replies.review_id
      and business_reviews.business_profile_id = business_review_replies.business_profile_id
  )
);

drop policy if exists "Owners can update replies for their business reviews" on public.business_review_replies;
create policy "Owners can update replies for their business reviews"
on public.business_review_replies
for update
to authenticated
using (
  owner_user_id = auth.uid()
  and exists (
    select 1
    from public.business_profiles
    where business_profiles.id = business_review_replies.business_profile_id
      and business_profiles.owner_id = auth.uid()
  )
)
with check (
  owner_user_id = auth.uid()
  and exists (
    select 1
    from public.business_profiles
    where business_profiles.id = business_review_replies.business_profile_id
      and business_profiles.owner_id = auth.uid()
  )
  and exists (
    select 1
    from public.business_reviews
    where business_reviews.id = business_review_replies.review_id
      and business_reviews.business_profile_id = business_review_replies.business_profile_id
  )
);

drop policy if exists "Owners can delete replies for their business reviews" on public.business_review_replies;
create policy "Owners can delete replies for their business reviews"
on public.business_review_replies
for delete
to authenticated
using (
  owner_user_id = auth.uid()
  and exists (
    select 1
    from public.business_profiles
    where business_profiles.id = business_review_replies.business_profile_id
      and business_profiles.owner_id = auth.uid()
  )
);
