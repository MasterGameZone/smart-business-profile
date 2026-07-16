-- Business Owner help and suggestion MVP.
-- Stores private business-owner suggestions and help requests.

create table if not exists public.business_owner_help_suggestions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  type text not null,
  subject text not null,
  message text not null,
  status text not null default 'submitted',
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint business_owner_help_suggestions_type_check check (
    type in (
      'suggestion',
      'help_request',
      'issue_problem',
      'profile_improvement_help'
    )
  ),
  constraint business_owner_help_suggestions_status_check check (
    status in ('submitted', 'in_review', 'replied', 'closed')
  ),
  constraint business_owner_help_suggestions_subject_length check (
    char_length(btrim(subject)) between 1 and 80
  ),
  constraint business_owner_help_suggestions_message_length check (
    char_length(btrim(message)) between 1 and 1000
  )
);

create index if not exists business_owner_help_suggestions_owner_created_at_idx
on public.business_owner_help_suggestions (owner_id, created_at desc);

alter table public.business_owner_help_suggestions enable row level security;

revoke all on table public.business_owner_help_suggestions from anon;
revoke all on table public.business_owner_help_suggestions from public;
grant select, insert on table public.business_owner_help_suggestions to authenticated;

drop policy if exists "Business owners can read their own help suggestions" on public.business_owner_help_suggestions;
create policy "Business owners can read their own help suggestions"
on public.business_owner_help_suggestions
for select
to authenticated
using ((select auth.uid()) = owner_id);

drop policy if exists "Business owners can insert their own help suggestions" on public.business_owner_help_suggestions;
create policy "Business owners can insert their own help suggestions"
on public.business_owner_help_suggestions
for insert
to authenticated
with check (
  (select auth.uid()) = owner_id
  and status = 'submitted'
);

drop trigger if exists set_business_owner_help_suggestions_updated_at on public.business_owner_help_suggestions;
create trigger set_business_owner_help_suggestions_updated_at
before update on public.business_owner_help_suggestions
for each row
execute function public.set_updated_at();
