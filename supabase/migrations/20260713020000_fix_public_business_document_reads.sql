-- Version 4.6 - Fix anonymous access to documents on public business profiles
-- Replaces the existing public document SELECT policy.
-- Access remains limited to files belonging to public business profiles under:
-- business-profiles/{owner_id}/{profile_id}/documents/{file_name}

drop policy if exists "Public can read public business documents"
  on storage.objects;

create policy "Public can read public business documents"
  on storage.objects
  for select
  to anon, authenticated
  using (
    bucket_id = 'business-documents'
    and (storage.foldername(name))[1] = 'business-profiles'
    and (storage.foldername(name))[4] = 'documents'
    and exists (
      select 1
      from public.business_profiles
      where business_profiles.owner_id::text =
        (storage.foldername(storage.objects.name))[2]
        and business_profiles.id::text =
          (storage.foldername(storage.objects.name))[3]
        and business_profiles.is_public is true
    )
  );
