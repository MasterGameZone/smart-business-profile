-- Customer Help & Feedback MVP.
-- Stores private customer-owned support requests, problem reports, and feedback.

create table if not exists public.customer_help_feedback_requests (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references auth.users(id) on delete cascade,
  request_type text not null,
  category text,
  title text not null,
  message text not null,
  satisfaction_level text,
  status text not null default 'Submitted',
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint customer_help_feedback_requests_type_check check (
    request_type in ('Contact Support', 'Problem Report', 'Feedback')
  ),
  constraint customer_help_feedback_requests_category_check check (
    category is null or category in (
      'Account issue',
      'Business profile issue',
      'Search or directory issue',
      'Saved businesses issue',
      'Reviews or reports issue',
      'Community feature issue',
      'Technical problem',
      'Other',
      'General feedback',
      'Feature suggestion',
      'Design feedback',
      'Bug feedback',
      'Category suggestion'
    )
  ),
  constraint customer_help_feedback_requests_satisfaction_level_check check (
    satisfaction_level is null or satisfaction_level in (
      'Very satisfied',
      'Satisfied',
      'Neutral',
      'Unsatisfied',
      'Very unsatisfied'
    )
  ),
  constraint customer_help_feedback_requests_status_check check (
    status in ('Submitted', 'Under Review', 'Resolved', 'Closed')
  ),
  constraint customer_help_feedback_requests_title_length check (
    char_length(btrim(title)) between 1 and 120
  ),
  constraint customer_help_feedback_requests_message_length check (
    char_length(btrim(message)) between 1 and 1200
  ),
  constraint customer_help_feedback_requests_title_no_links check (
    title !~* '(https?://|www\.|[a-z0-9-]+\.[a-z]{2,})'
  ),
  constraint customer_help_feedback_requests_message_no_links check (
    message !~* '(https?://|www\.|[a-z0-9-]+\.[a-z]{2,})'
  )
);

create index if not exists customer_help_feedback_requests_customer_created_at_idx
on public.customer_help_feedback_requests (customer_id, created_at desc);

alter table public.customer_help_feedback_requests enable row level security;

revoke all on table public.customer_help_feedback_requests from anon;
revoke all on table public.customer_help_feedback_requests from public;
grant insert on table public.customer_help_feedback_requests to authenticated;

drop policy if exists "Customers can insert their own help feedback requests" on public.customer_help_feedback_requests;
create policy "Customers can insert their own help feedback requests"
on public.customer_help_feedback_requests
for insert
to authenticated
with check (
  (select auth.uid()) = customer_id
  and status = 'Submitted'
);

drop trigger if exists set_customer_help_feedback_requests_updated_at on public.customer_help_feedback_requests;
create trigger set_customer_help_feedback_requests_updated_at
before update on public.customer_help_feedback_requests
for each row
execute function public.set_updated_at();
