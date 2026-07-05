-- Version 3.8 - Supabase Storage Foundation
-- Creates the public business-assets bucket for public-facing business profile images.
--
-- Manual review required before applying in Supabase SQL Editor.
--
-- Intended path structure:
--   business-profiles/{owner_id}/{business_profile_id}/logo/{file}
--   business-profiles/{owner_id}/{business_profile_id}/cover/{file}
--   business-profiles/{owner_id}/{business_profile_id}/gallery/{file}
--
-- Security notes:
--   - Public read is intentional because these assets appear on public profiles and directory cards.
--   - Authenticated writes are restricted to the caller's own owner_id folder.
--   - Application code also controls generated upload paths.
--   - If future business ownership moves beyond owner_id folders, review these policies before reuse.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'business-assets',
  'business-assets',
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
      and policyname = 'Business assets are publicly readable'
  ) then
    create policy "Business assets are publicly readable"
      on storage.objects
      for select
      using (bucket_id = 'business-assets');
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
      and policyname = 'Authenticated users can upload their business assets'
  ) then
    create policy "Authenticated users can upload their business assets"
      on storage.objects
      for insert
      to authenticated
      with check (
        bucket_id = 'business-assets'
        and (storage.foldername(name))[1] = 'business-profiles'
        and (storage.foldername(name))[2] = auth.uid()::text
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
      and policyname = 'Authenticated users can update their business assets'
  ) then
    create policy "Authenticated users can update their business assets"
      on storage.objects
      for update
      to authenticated
      using (
        bucket_id = 'business-assets'
        and (storage.foldername(name))[1] = 'business-profiles'
        and (storage.foldername(name))[2] = auth.uid()::text
      )
      with check (
        bucket_id = 'business-assets'
        and (storage.foldername(name))[1] = 'business-profiles'
        and (storage.foldername(name))[2] = auth.uid()::text
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
      and policyname = 'Authenticated users can delete their business assets'
  ) then
    create policy "Authenticated users can delete their business assets"
      on storage.objects
      for delete
      to authenticated
      using (
        bucket_id = 'business-assets'
        and (storage.foldername(name))[1] = 'business-profiles'
        and (storage.foldername(name))[2] = auth.uid()::text
      );
  end if;
end
$$;
