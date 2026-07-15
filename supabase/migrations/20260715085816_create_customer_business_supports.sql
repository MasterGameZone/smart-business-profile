-- Customer Support a Business nominations.
-- Stores customer-owned business invitations without creating business profiles.

create table if not exists public.customer_business_supports (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references auth.users(id) on delete cascade,
  business_name text not null,
  business_category text not null default 'Not specified',
  business_location text not null,
  custom_message text,
  invitation_token uuid not null default gen_random_uuid(),
  status text not null default 'Nominated',
  invitation_shared_at timestamp with time zone,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint customer_business_supports_business_name_length check (
    char_length(btrim(business_name)) between 1 and 80
  ),
  constraint customer_business_supports_business_location_length check (
    char_length(btrim(business_location)) between 1 and 120
  ),
  constraint customer_business_supports_custom_message_length check (
    custom_message is null or char_length(btrim(custom_message)) <= 300
  ),
  constraint customer_business_supports_status_check check (
    status in ('Nominated', 'Invitation Shared', 'Profile Published')
  )
);

create index if not exists customer_business_supports_customer_created_at_idx
on public.customer_business_supports (customer_id, created_at desc);

alter table public.customer_business_supports enable row level security;

revoke all on table public.customer_business_supports from anon;
revoke all on table public.customer_business_supports from public;
grant select, insert, update on table public.customer_business_supports to authenticated;

drop policy if exists "Customers can read their own supported businesses" on public.customer_business_supports;
create policy "Customers can read their own supported businesses"
on public.customer_business_supports
for select
to authenticated
using ((select auth.uid()) = customer_id);

drop policy if exists "Customers can insert their own supported businesses" on public.customer_business_supports;
create policy "Customers can insert their own supported businesses"
on public.customer_business_supports
for insert
to authenticated
with check ((select auth.uid()) = customer_id);

drop policy if exists "Customers can update their own supported businesses" on public.customer_business_supports;
create policy "Customers can update their own supported businesses"
on public.customer_business_supports
for update
to authenticated
using ((select auth.uid()) = customer_id)
with check ((select auth.uid()) = customer_id);

drop trigger if exists set_customer_business_supports_updated_at on public.customer_business_supports;
create trigger set_customer_business_supports_updated_at
before update on public.customer_business_supports
for each row
execute function public.set_updated_at();
