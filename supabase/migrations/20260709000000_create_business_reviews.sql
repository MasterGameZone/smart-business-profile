-- Version 4.17 - Ratings & Reviews
-- Adds public-profile reviews with one review per authenticated user per business.

create table if not exists public.business_reviews (
  id uuid primary key default gen_random_uuid(),
  business_profile_id uuid not null references public.business_profiles (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  rating integer not null,
  review_text text,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint business_reviews_rating_check check (rating between 1 and 5),
  constraint business_reviews_user_id_business_profile_id_key unique (user_id, business_profile_id)
);

create index if not exists business_reviews_business_profile_id_created_at_idx
on public.business_reviews (business_profile_id, created_at desc);

drop trigger if exists set_business_reviews_updated_at on public.business_reviews;

create trigger set_business_reviews_updated_at
before update on public.business_reviews
for each row
execute function public.set_updated_at();

alter table public.business_reviews enable row level security;

drop policy if exists "Public can read reviews for public business profiles" on public.business_reviews;
create policy "Public can read reviews for public business profiles"
on public.business_reviews
for select
to anon, authenticated
using (
  exists (
    select 1
    from public.business_profiles
    where business_profiles.id = business_reviews.business_profile_id
      and business_profiles.is_public is true
  )
);

drop policy if exists "Users can insert their own reviews" on public.business_reviews;
create policy "Users can insert their own reviews"
on public.business_reviews
for insert
to authenticated
with check (
  user_id = auth.uid()
  and exists (
    select 1
    from public.business_profiles
    where business_profiles.id = business_reviews.business_profile_id
      and business_profiles.is_public is true
  )
);

drop policy if exists "Users can update their own reviews" on public.business_reviews;
create policy "Users can update their own reviews"
on public.business_reviews
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "Users can delete their own reviews" on public.business_reviews;
create policy "Users can delete their own reviews"
on public.business_reviews
for delete
to authenticated
using (user_id = auth.uid());
