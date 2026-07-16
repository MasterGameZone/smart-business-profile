-- Adds a manual business availability override for owner-controlled
-- Open / Closed status without changing profile visibility.

alter table public.business_profiles
  add column if not exists availability_override text,
  add column if not exists availability_override_updated_at timestamptz;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'business_profiles_availability_override_check'
  ) then
    alter table public.business_profiles
      add constraint business_profiles_availability_override_check
      check (
        availability_override is null
        or availability_override in ('open', 'closed')
      );
  end if;
end $$;

comment on column public.business_profiles.availability_override is
  'Manual business availability override. Allowed values: open, closed, or null for no override.';

comment on column public.business_profiles.availability_override_updated_at is
  'Timestamp for the last manual availability override update.';
