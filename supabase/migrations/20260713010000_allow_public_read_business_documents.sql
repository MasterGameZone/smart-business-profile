-- Version 4.5 - Allow public read access for business documents on public profiles
-- Adds a storage.objects SELECT policy limited to business-documents files that
-- belong to public business profiles under the existing business-profiles/{owner_id}/{profile_id}/documents path.

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Public can read public business documents'
  ) then
    create policy "Public can read public business documents"
      on storage.objects
      for select
      to anon, authenticated
      using (
        bucket_id = 'business-documents'
        and (storage.foldername(name))[1] = 'business-profiles'
        and (storage.foldername(name))[4] = 'documents'
        and storage.allow_any_operation(array['object.get_authenticated', 'object.get_authenticated_info'])
        and exists (
          select 1
          from public.business_profiles
          where business_profiles.owner_id::text = (storage.foldername(name))[2]
            and business_profiles.id::text = (storage.foldername(name))[3]
            and business_profiles.is_public is true
        )
      );
  end if;
end
$$;
