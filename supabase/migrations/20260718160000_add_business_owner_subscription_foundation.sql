-- Subscription state and webhook-audit foundation. No checkout or entitlement UI is included.

create table public.business_owner_subscriptions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  plan_id text not null,
  billing_provider text not null,
  provider_customer_id text,
  provider_subscription_id text,
  provider_plan_id text,
  status text not null default 'incomplete',
  billing_interval text not null default 'monthly',
  currency text not null default 'INR',
  amount_minor_units integer not null default 4500,
  current_period_start timestamp with time zone,
  current_period_end timestamp with time zone,
  cancel_at_period_end boolean not null default false,
  grace_period_end timestamp with time zone,
  canceled_at timestamp with time zone,
  ended_at timestamp with time zone,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint business_owner_subscriptions_owner_id_key unique (owner_id),
  constraint business_owner_subscriptions_plan_id_check check (
    plan_id = 'pro_analytics'
  ),
  constraint business_owner_subscriptions_status_check check (
    status in ('incomplete', 'active', 'past_due', 'canceled', 'expired')
  ),
  constraint business_owner_subscriptions_billing_interval_check check (
    billing_interval = 'monthly'
  ),
  constraint business_owner_subscriptions_currency_check check (
    currency = 'INR'
  ),
  constraint business_owner_subscriptions_amount_minor_units_check check (
    amount_minor_units > 0
  ),
  constraint business_owner_subscriptions_period_check check (
    current_period_start is null
    or current_period_end is null
    or current_period_end > current_period_start
  ),
  constraint business_owner_subscriptions_billing_provider_length_check check (
    char_length(btrim(billing_provider)) between 1 and 50
  )
);

create unique index business_owner_subscriptions_provider_subscription_id_key
on public.business_owner_subscriptions (billing_provider, provider_subscription_id)
where provider_subscription_id is not null;

create index business_owner_subscriptions_provider_customer_id_idx
on public.business_owner_subscriptions (billing_provider, provider_customer_id);

create index business_owner_subscriptions_status_current_period_end_idx
on public.business_owner_subscriptions (status, current_period_end);

create table public.subscription_webhook_events (
  id uuid primary key default gen_random_uuid(),
  billing_provider text not null,
  provider_event_id text not null,
  event_type text not null,
  subscription_id uuid references public.business_owner_subscriptions(id) on delete set null,
  owner_id uuid references auth.users(id) on delete set null,
  provider_customer_id text,
  provider_subscription_id text,
  provider_created_at timestamp with time zone,
  processing_status text not null default 'received',
  processing_attempts integer not null default 0,
  payload jsonb not null default '{}'::jsonb,
  last_error text,
  received_at timestamp with time zone not null default now(),
  processed_at timestamp with time zone,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint subscription_webhook_events_billing_provider_event_id_key unique (
    billing_provider,
    provider_event_id
  ),
  constraint subscription_webhook_events_processing_status_check check (
    processing_status in ('received', 'processed', 'ignored', 'failed')
  ),
  constraint subscription_webhook_events_processing_attempts_check check (
    processing_attempts >= 0
  ),
  constraint subscription_webhook_events_billing_provider_length_check check (
    char_length(btrim(billing_provider)) between 1 and 50
  ),
  constraint subscription_webhook_events_provider_event_id_check check (
    char_length(btrim(provider_event_id)) > 0
  ),
  constraint subscription_webhook_events_event_type_check check (
    char_length(btrim(event_type)) > 0
  ),
  constraint subscription_webhook_events_payload_object_check check (
    jsonb_typeof(payload) = 'object'
  )
);

create index subscription_webhook_events_provider_subscription_id_idx
on public.subscription_webhook_events (provider_subscription_id);

create index subscription_webhook_events_subscription_id_idx
on public.subscription_webhook_events (subscription_id);

create index subscription_webhook_events_processing_status_received_at_idx
on public.subscription_webhook_events (processing_status, received_at);

create function public.set_subscription_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke all on function public.set_subscription_updated_at() from public, anon, authenticated;

create trigger set_business_owner_subscriptions_updated_at
before update on public.business_owner_subscriptions
for each row
execute function public.set_subscription_updated_at();

create trigger set_subscription_webhook_events_updated_at
before update on public.subscription_webhook_events
for each row
execute function public.set_subscription_updated_at();

alter table public.business_owner_subscriptions enable row level security;
alter table public.subscription_webhook_events enable row level security;

revoke all on table public.business_owner_subscriptions from public, anon, authenticated;
revoke all on table public.subscription_webhook_events from public, anon, authenticated;

grant select (
  owner_id,
  plan_id,
  status,
  billing_interval,
  currency,
  amount_minor_units,
  current_period_start,
  current_period_end,
  cancel_at_period_end,
  grace_period_end
) on table public.business_owner_subscriptions to authenticated;

grant select, insert, update on table public.business_owner_subscriptions to service_role;
grant select, insert, update on table public.subscription_webhook_events to service_role;

create policy "Authenticated owners can read their own subscription"
on public.business_owner_subscriptions
for select
to authenticated
using ((select auth.uid()) = owner_id);

create function public.get_my_business_subscription()
returns table (
  plan_id text,
  subscription_status text,
  billing_interval text,
  currency text,
  amount_minor_units integer,
  current_period_start timestamp with time zone,
  current_period_end timestamp with time zone,
  cancel_at_period_end boolean,
  grace_period_end timestamp with time zone,
  has_pro_access boolean
)
language sql
stable
security invoker
set search_path = ''
as $$
  with current_subscription as (
    select
      subscription.plan_id,
      subscription.status,
      subscription.billing_interval,
      subscription.currency,
      subscription.amount_minor_units,
      subscription.current_period_start,
      subscription.current_period_end,
      subscription.cancel_at_period_end,
      subscription.grace_period_end
    from public.business_owner_subscriptions as subscription
    where subscription.owner_id = (select auth.uid())
    limit 1
  )
  select
    coalesce(subscription.plan_id, 'free')::text,
    coalesce(subscription.status, 'free')::text,
    subscription.billing_interval,
    coalesce(subscription.currency, 'INR')::text,
    coalesce(subscription.amount_minor_units, 0)::integer,
    subscription.current_period_start,
    subscription.current_period_end,
    coalesce(subscription.cancel_at_period_end, false),
    subscription.grace_period_end,
    coalesce(
      (
        subscription.status = 'active'
        and subscription.current_period_end is not null
        and subscription.current_period_end > now()
      )
      or (
        subscription.status = 'past_due'
        and subscription.grace_period_end is not null
        and subscription.grace_period_end > now()
      )
      or (
        subscription.status = 'canceled'
        and subscription.current_period_end is not null
        and subscription.current_period_end > now()
      ),
      false
    )
  from (select 1) as fallback
  left join current_subscription as subscription on true;
$$;

revoke all on function public.get_my_business_subscription() from public, anon, authenticated;
grant execute on function public.get_my_business_subscription() to authenticated;

notify pgrst, 'reload schema';
