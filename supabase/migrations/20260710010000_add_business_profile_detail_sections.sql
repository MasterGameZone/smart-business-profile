-- Version 4.21 - Business Profile Detail Sections
-- Adds optional structured profile detail fields and private document metadata.

alter table public.business_profiles
  add column if not exists established_year integer,
  add column if not exists years_of_experience integer,
  add column if not exists highlights text[] default ARRAY[]::text[],
  add column if not exists faqs jsonb default '[]'::jsonb,
  add column if not exists products_menu_packages jsonb default '[]'::jsonb,
  add column if not exists qualifications jsonb default '[]'::jsonb;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'business_profiles_established_year_check'
  ) then
    alter table public.business_profiles
      add constraint business_profiles_established_year_check
      check (
        established_year is null
        or (
          established_year between 1000 and extract(year from now())::integer
        )
      );
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'business_profiles_years_of_experience_check'
  ) then
    alter table public.business_profiles
      add constraint business_profiles_years_of_experience_check
      check (
        years_of_experience is null
        or years_of_experience >= 0
      );
  end if;
end
$$;

create table if not exists public.business_profile_documents (
  id uuid primary key default gen_random_uuid(),
  business_profile_id uuid not null references public.business_profiles (id) on delete cascade,
  owner_id uuid not null references auth.users (id) on delete cascade,
  file_name text not null,
  file_path text not null,
  mime_type text not null,
  created_at timestamp with time zone not null default now()
);

create index if not exists business_profile_documents_business_profile_id_idx
on public.business_profile_documents (business_profile_id);

create index if not exists business_profile_documents_owner_id_idx
on public.business_profile_documents (owner_id);

alter table public.business_profile_documents enable row level security;

drop policy if exists "Owners can read their business profile documents" on public.business_profile_documents;
create policy "Owners can read their business profile documents"
on public.business_profile_documents
for select
to authenticated
using (
  owner_id = auth.uid()
  and exists (
    select 1
    from public.business_profiles
    where business_profiles.id = business_profile_documents.business_profile_id
      and business_profiles.owner_id = auth.uid()
  )
);

drop policy if exists "Owners can insert their business profile documents" on public.business_profile_documents;
create policy "Owners can insert their business profile documents"
on public.business_profile_documents
for insert
to authenticated
with check (
  owner_id = auth.uid()
  and exists (
    select 1
    from public.business_profiles
    where business_profiles.id = business_profile_documents.business_profile_id
      and business_profiles.owner_id = auth.uid()
  )
);

drop policy if exists "Owners can delete their business profile documents" on public.business_profile_documents;
create policy "Owners can delete their business profile documents"
on public.business_profile_documents
for delete
to authenticated
using (
  owner_id = auth.uid()
  and exists (
    select 1
    from public.business_profiles
    where business_profiles.id = business_profile_documents.business_profile_id
      and business_profiles.owner_id = auth.uid()
  )
);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'business-documents',
  'business-documents',
  false,
  10485760,
  array['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
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
      and policyname = 'Owners can read their business documents'
  ) then
    create policy "Owners can read their business documents"
      on storage.objects
      for select
      to authenticated
      using (
        bucket_id = 'business-documents'
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
      and policyname = 'Owners can upload their business documents'
  ) then
    create policy "Owners can upload their business documents"
      on storage.objects
      for insert
      to authenticated
      with check (
        bucket_id = 'business-documents'
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
      and policyname = 'Owners can update their business documents'
  ) then
    create policy "Owners can update their business documents"
      on storage.objects
      for update
      to authenticated
      using (
        bucket_id = 'business-documents'
        and (storage.foldername(name))[1] = 'business-profiles'
        and (storage.foldername(name))[2] = auth.uid()::text
      )
      with check (
        bucket_id = 'business-documents'
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
      and policyname = 'Owners can delete their business documents'
  ) then
    create policy "Owners can delete their business documents"
      on storage.objects
      for delete
      to authenticated
      using (
        bucket_id = 'business-documents'
        and (storage.foldername(name))[1] = 'business-profiles'
        and (storage.foldername(name))[2] = auth.uid()::text
      );
  end if;
end
$$;
