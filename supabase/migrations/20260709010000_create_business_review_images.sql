-- Version 4.17.1 - Review Image Uploads
-- Adds review image metadata and a public review-images storage bucket.

create table if not exists public.business_review_images (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null references public.business_reviews (id) on delete cascade,
  business_profile_id uuid not null references public.business_profiles (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  image_path text not null,
  sort_order integer not null default 0,
  created_at timestamp with time zone not null default now(),
  constraint business_review_images_sort_order_check check (sort_order between 0 and 2)
);

create index if not exists business_review_images_review_id_idx
on public.business_review_images (review_id);

create index if not exists business_review_images_business_profile_id_idx
on public.business_review_images (business_profile_id);

create index if not exists business_review_images_user_id_idx
on public.business_review_images (user_id);

alter table public.business_review_images enable row level security;

drop policy if exists "Public can read images for public review profiles" on public.business_review_images;
create policy "Public can read images for public review profiles"
on public.business_review_images
for select
to anon, authenticated
using (
  exists (
    select 1
    from public.business_profiles
    where business_profiles.id = business_review_images.business_profile_id
      and business_profiles.is_public is true
  )
);

drop policy if exists "Users can insert their own review images" on public.business_review_images;
create policy "Users can insert their own review images"
on public.business_review_images
for insert
to authenticated
with check (
  user_id = auth.uid()
  and exists (
    select 1
    from public.business_reviews
    where business_reviews.id = business_review_images.review_id
      and business_reviews.user_id = auth.uid()
      and business_reviews.business_profile_id = business_review_images.business_profile_id
  )
);

drop policy if exists "Users can delete their own review images" on public.business_review_images;
create policy "Users can delete their own review images"
on public.business_review_images
for delete
to authenticated
using (user_id = auth.uid());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'review-images',
  'review-images',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Review images are publicly readable'
  ) then
    create policy "Review images are publicly readable"
      on storage.objects
      for select
      using (bucket_id = 'review-images');
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Authenticated users can upload their review images'
  ) then
    create policy "Authenticated users can upload their review images"
      on storage.objects
      for insert
      to authenticated
      with check (
        bucket_id = 'review-images'
        and (storage.foldername(name))[1] = auth.uid()::text
      );
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Authenticated users can delete their review images'
  ) then
    create policy "Authenticated users can delete their review images"
      on storage.objects
      for delete
      to authenticated
      using (
        bucket_id = 'review-images'
        and (storage.foldername(name))[1] = auth.uid()::text
      );
  end if;
end
$$;
