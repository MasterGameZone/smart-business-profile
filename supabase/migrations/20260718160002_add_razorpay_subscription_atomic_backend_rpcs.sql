-- Adds atomic backend-only Razorpay subscription creation and webhook processing foundations.

alter table public.business_owner_subscriptions
  add column creation_attempt_id uuid,
  add column creation_started_at timestamp with time zone,
  add constraint business_owner_subscriptions_creation_lease_check check (
    (creation_attempt_id is null and creation_started_at is null)
    or (creation_attempt_id is not null and creation_started_at is not null)
  );

create index business_owner_subscriptions_creation_started_at_idx
on public.business_owner_subscriptions (creation_started_at)
where creation_attempt_id is not null;

create function public.claim_razorpay_subscription_creation(p_owner_id uuid)
returns table (
  decision text,
  internal_subscription_id uuid,
  creation_attempt_id uuid,
  provider_subscription_id text,
  internal_status text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_subscription public.business_owner_subscriptions%rowtype;
  v_attempt_id uuid;
begin
  if p_owner_id is null then
    raise exception using
      errcode = '42501',
      message = 'Business owner is not eligible.';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_owner_id::text, 0::bigint)
  );

  if not exists (
    select 1
    from auth.users as user_record
    where user_record.id = p_owner_id
  )
  or not exists (
    select 1
    from public.user_account_preferences as preferences
    where preferences.user_id = p_owner_id
      and preferences.owner_enabled is true
  )
  or not exists (
    select 1
    from public.business_profiles as profile
    where profile.owner_id = p_owner_id
  ) then
    raise exception using
      errcode = '42501',
      message = 'Business owner is not eligible.';
  end if;

  select subscription.*
  into v_subscription
  from public.business_owner_subscriptions as subscription
  where subscription.owner_id = p_owner_id
  for update;

  if not found then
    v_attempt_id := pg_catalog.gen_random_uuid();

    insert into public.business_owner_subscriptions (
      owner_id,
      plan_id,
      billing_provider,
      status,
      billing_interval,
      currency,
      amount_minor_units,
      creation_attempt_id,
      creation_started_at
    )
    values (
      p_owner_id,
      'pro_analytics',
      'razorpay',
      'incomplete',
      'monthly',
      'INR',
      4500,
      v_attempt_id,
      pg_catalog.now()
    )
    returning * into v_subscription;

    return query
    select
      'create'::text,
      v_subscription.id,
      v_attempt_id,
      v_subscription.provider_subscription_id,
      v_subscription.status;
    return;
  end if;

  if v_subscription.creation_attempt_id is not null
    and v_subscription.creation_started_at > pg_catalog.now() - interval '5 minutes' then
    return query
    select
      'in_progress'::text,
      v_subscription.id,
      v_subscription.creation_attempt_id,
      v_subscription.provider_subscription_id,
      v_subscription.status;
    return;
  end if;

  if v_subscription.creation_attempt_id is not null then
    return query
    select
      'inspect_existing'::text,
      v_subscription.id,
      v_subscription.creation_attempt_id,
      v_subscription.provider_subscription_id,
      v_subscription.status;
    return;
  end if;

  if v_subscription.status = 'incomplete'
    and nullif(pg_catalog.btrim(v_subscription.provider_subscription_id), '') is not null then
    return query
    select
      'inspect_existing'::text,
      v_subscription.id,
      v_subscription.creation_attempt_id,
      v_subscription.provider_subscription_id,
      v_subscription.status;
    return;
  end if;

  if v_subscription.status in ('active', 'past_due')
    or (
      v_subscription.status = 'canceled'
      and v_subscription.current_period_end is not null
      and v_subscription.current_period_end > pg_catalog.now()
    ) then
    return query
    select
      'blocked'::text,
      v_subscription.id,
      v_subscription.creation_attempt_id,
      v_subscription.provider_subscription_id,
      v_subscription.status;
    return;
  end if;

  if v_subscription.status = 'expired'
    or (
      v_subscription.status = 'canceled'
      and (
        v_subscription.current_period_end is null
        or v_subscription.current_period_end <= pg_catalog.now()
      )
    )
    or (
      v_subscription.status = 'incomplete'
      and v_subscription.creation_attempt_id is null
      and v_subscription.creation_started_at is null
      and nullif(pg_catalog.btrim(v_subscription.provider_subscription_id), '') is null
    ) then
    v_attempt_id := pg_catalog.gen_random_uuid();

    update public.business_owner_subscriptions as subscription
    set
      plan_id = 'pro_analytics',
      billing_provider = 'razorpay',
      provider_subscription_id = null,
      provider_plan_id = null,
      status = 'incomplete',
      billing_interval = 'monthly',
      currency = 'INR',
      amount_minor_units = 4500,
      current_period_start = null,
      current_period_end = null,
      cancel_at_period_end = false,
      grace_period_end = null,
      canceled_at = null,
      ended_at = null,
      creation_attempt_id = v_attempt_id,
      creation_started_at = pg_catalog.now()
    where subscription.id = v_subscription.id
    returning * into v_subscription;

    return query
    select
      'create'::text,
      v_subscription.id,
      v_attempt_id,
      v_subscription.provider_subscription_id,
      v_subscription.status;
    return;
  end if;

  return query
  select
    'blocked'::text,
    v_subscription.id,
    v_subscription.creation_attempt_id,
    v_subscription.provider_subscription_id,
    v_subscription.status;
end;
$$;

create function public.finalize_razorpay_subscription_creation(
  p_owner_id uuid,
  p_creation_attempt_id uuid,
  p_provider_subscription_id text,
  p_provider_plan_id text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_provider_subscription_id text := nullif(pg_catalog.btrim(p_provider_subscription_id), '');
  v_provider_plan_id text := nullif(pg_catalog.btrim(p_provider_plan_id), '');
begin
  if p_owner_id is null
    or p_creation_attempt_id is null
    or v_provider_subscription_id is null
    or v_provider_plan_id is null then
    raise exception using
      errcode = '22023',
      message = 'Invalid subscription creation data.';
  end if;

  update public.business_owner_subscriptions as subscription
  set
    billing_provider = 'razorpay',
    provider_subscription_id = v_provider_subscription_id,
    provider_plan_id = v_provider_plan_id,
    status = 'incomplete',
    current_period_start = null,
    current_period_end = null,
    cancel_at_period_end = false,
    grace_period_end = null,
    canceled_at = null,
    ended_at = null,
    creation_attempt_id = null,
    creation_started_at = null
  where subscription.owner_id = p_owner_id
    and subscription.creation_attempt_id = p_creation_attempt_id;

  return found;
end;
$$;

create function public.release_razorpay_subscription_creation(
  p_owner_id uuid,
  p_creation_attempt_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_owner_id is null or p_creation_attempt_id is null then
    raise exception using
      errcode = '22023',
      message = 'Invalid subscription creation data.';
  end if;

  update public.business_owner_subscriptions as subscription
  set
    creation_attempt_id = null,
    creation_started_at = null
  where subscription.owner_id = p_owner_id
    and subscription.creation_attempt_id = p_creation_attempt_id;

  return found;
end;
$$;

create function public.process_razorpay_subscription_webhook(
  p_provider_event_id text,
  p_event_type text,
  p_provider_created_at timestamp with time zone,
  p_provider_subscription_id text,
  p_provider_plan_id text,
  p_provider_customer_id text,
  p_provider_status text,
  p_current_period_start timestamp with time zone,
  p_current_period_end timestamp with time zone,
  p_ended_at timestamp with time zone,
  p_sanitized_payload jsonb
)
returns table (
  result text,
  webhook_event_id uuid,
  internal_subscription_id uuid,
  internal_status text,
  processing_attempts integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event public.subscription_webhook_events%rowtype;
  v_subscription public.business_owner_subscriptions%rowtype;
  v_event_id uuid;
  v_processing_attempts integer;
  v_provider_event_id text := nullif(pg_catalog.btrim(p_provider_event_id), '');
  v_event_type text := nullif(pg_catalog.btrim(p_event_type), '');
  v_provider_subscription_id text := nullif(pg_catalog.btrim(p_provider_subscription_id), '');
  v_provider_plan_id text := nullif(pg_catalog.btrim(p_provider_plan_id), '');
  v_provider_customer_id text := nullif(pg_catalog.btrim(p_provider_customer_id), '');
  v_provider_status text := nullif(pg_catalog.btrim(p_provider_status), '');
  v_latest_processed_at timestamp with time zone;
  v_current_internal_status text;
begin
  if v_provider_event_id is null
    or v_event_type is null
    or p_provider_created_at is null
    or v_provider_subscription_id is null
    or v_provider_plan_id is null
    or v_provider_status is null
    or pg_catalog.jsonb_typeof(p_sanitized_payload) is distinct from 'object' then
    raise exception using
      errcode = '22023',
      message = 'Invalid webhook event data.';
  end if;

  if v_provider_status not in (
    'created',
    'authenticated',
    'active',
    'pending',
    'halted',
    'paused',
    'cancelled',
    'completed',
    'expired'
  ) then
    raise exception using
      errcode = '22023',
      message = 'Invalid webhook event data.';
  end if;

  insert into public.subscription_webhook_events (
    billing_provider,
    provider_event_id,
    event_type,
    provider_customer_id,
    provider_subscription_id,
    provider_created_at,
    payload
  )
  values (
    'razorpay',
    v_provider_event_id,
    v_event_type,
    v_provider_customer_id,
    v_provider_subscription_id,
    p_provider_created_at,
    p_sanitized_payload
  )
  on conflict (billing_provider, provider_event_id) do nothing
  returning id into v_event_id;

  if v_event_id is null then
    select event.*
    into v_event
    from public.subscription_webhook_events as event
    where event.billing_provider = 'razorpay'
      and event.provider_event_id = v_provider_event_id
    for update;

    if v_event.processing_status in ('processed', 'ignored') then
      return query
      select
        'duplicate'::text,
        v_event.id,
        v_event.subscription_id,
        null::text,
        v_event.processing_attempts;
      return;
    end if;

    if nullif(pg_catalog.btrim(v_event.event_type), '') is distinct from v_event_type
      or nullif(pg_catalog.btrim(v_event.provider_subscription_id), '')
        is distinct from v_provider_subscription_id
      or v_event.provider_created_at is distinct from p_provider_created_at then
      update public.subscription_webhook_events as event
      set
        processing_status = 'failed',
        processing_attempts = event.processing_attempts + 1,
        processed_at = pg_catalog.now(),
        last_error = 'Provider event identity mismatch.'
      where event.id = v_event.id
      returning processing_attempts into v_processing_attempts;

      return query
      select
        'failed'::text,
        v_event.id,
        v_event.subscription_id,
        null::text,
        v_processing_attempts;
      return;
    end if;
  else
    select event.*
    into v_event
    from public.subscription_webhook_events as event
    where event.id = v_event_id
    for update;
  end if;

  update public.subscription_webhook_events as event
  set
    processing_status = 'received',
    processing_attempts = event.processing_attempts + 1,
    processed_at = null,
    last_error = null
  where event.id = v_event.id
  returning processing_attempts into v_processing_attempts;

  if v_event_type not in (
    'subscription.authenticated',
    'subscription.activated',
    'subscription.charged',
    'subscription.completed',
    'subscription.updated',
    'subscription.pending',
    'subscription.halted',
    'subscription.cancelled',
    'subscription.paused',
    'subscription.resumed'
  ) then
    update public.subscription_webhook_events as event
    set
      processing_status = 'ignored',
      processed_at = pg_catalog.now(),
      last_error = null
    where event.id = v_event.id;

    return query
    select
      'ignored'::text,
      v_event.id,
      null::uuid,
      null::text,
      v_processing_attempts;
    return;
  end if;

  select subscription.*
  into v_subscription
  from public.business_owner_subscriptions as subscription
  where subscription.billing_provider = 'razorpay'
    and subscription.provider_subscription_id = v_provider_subscription_id
  for update;

  if not found then
    update public.subscription_webhook_events as event
    set
      provider_customer_id = coalesce(v_provider_customer_id, event.provider_customer_id),
      provider_subscription_id = v_provider_subscription_id,
      processing_status = 'failed',
      processed_at = pg_catalog.now(),
      last_error = 'Subscription could not be correlated.'
    where event.id = v_event.id;

    return query
    select
      'subscription_not_found'::text,
      v_event.id,
      null::uuid,
      null::text,
      v_processing_attempts;
    return;
  end if;

  update public.subscription_webhook_events as event
  set
    subscription_id = v_subscription.id,
    owner_id = v_subscription.owner_id,
    provider_customer_id = coalesce(v_provider_customer_id, event.provider_customer_id),
    provider_subscription_id = v_provider_subscription_id
  where event.id = v_event.id;

  begin

    if v_subscription.plan_id is distinct from 'pro_analytics'
      or v_subscription.billing_provider is distinct from 'razorpay'
      or (
        v_subscription.provider_plan_id is not null
        and v_subscription.provider_plan_id <> v_provider_plan_id
      ) then
      update public.subscription_webhook_events as event
      set
        processing_status = 'failed',
        processed_at = pg_catalog.now(),
        last_error = 'Provider plan could not be verified.'
      where event.id = v_event.id;

      return query
      select
        'plan_mismatch'::text,
        v_event.id,
        v_subscription.id,
        v_subscription.status,
        v_processing_attempts;
      return;
    end if;

    select pg_catalog.max(event.provider_created_at)
    into v_latest_processed_at
    from public.subscription_webhook_events as event
    where event.subscription_id = v_subscription.id
      and event.processing_status = 'processed'
      and event.id <> v_event.id;

    if v_latest_processed_at is not null
      and p_provider_created_at < v_latest_processed_at then
      update public.subscription_webhook_events as event
      set
        processing_status = 'ignored',
        processed_at = pg_catalog.now(),
        last_error = null
      where event.id = v_event.id;

      return query
      select
        'stale_event'::text,
        v_event.id,
        v_subscription.id,
        v_subscription.status,
        v_processing_attempts;
      return;
    end if;

    if v_provider_status in ('created', 'authenticated') then
      update public.business_owner_subscriptions as subscription
      set
        provider_customer_id = coalesce(v_provider_customer_id, subscription.provider_customer_id),
        provider_plan_id = v_provider_plan_id,
        status = 'incomplete',
        grace_period_end = null,
        creation_attempt_id = null,
        creation_started_at = null
      where subscription.id = v_subscription.id;
      v_subscription.status := 'incomplete';
    elsif v_provider_status = 'active' then
      update public.business_owner_subscriptions as subscription
      set
        provider_customer_id = coalesce(v_provider_customer_id, subscription.provider_customer_id),
        provider_plan_id = v_provider_plan_id,
        status = 'active',
        current_period_start = p_current_period_start,
        current_period_end = p_current_period_end,
        grace_period_end = null,
        canceled_at = null,
        ended_at = null,
        creation_attempt_id = null,
        creation_started_at = null
      where subscription.id = v_subscription.id;
      v_subscription.status := 'active';
    elsif v_provider_status = 'pending' then
      update public.business_owner_subscriptions as subscription
      set
        provider_customer_id = coalesce(v_provider_customer_id, subscription.provider_customer_id),
        provider_plan_id = v_provider_plan_id,
        status = 'past_due',
        current_period_start = coalesce(p_current_period_start, subscription.current_period_start),
        current_period_end = coalesce(p_current_period_end, subscription.current_period_end),
        grace_period_end = coalesce(
          subscription.grace_period_end,
          pg_catalog.now() + interval '3 days'
        ),
        creation_attempt_id = null,
        creation_started_at = null
      where subscription.id = v_subscription.id;
      v_subscription.status := 'past_due';
    elsif v_provider_status = 'halted' then
      update public.business_owner_subscriptions as subscription
      set
        provider_customer_id = coalesce(v_provider_customer_id, subscription.provider_customer_id),
        provider_plan_id = v_provider_plan_id,
        status = 'past_due',
        current_period_start = coalesce(p_current_period_start, subscription.current_period_start),
        current_period_end = coalesce(p_current_period_end, subscription.current_period_end),
        creation_attempt_id = null,
        creation_started_at = null
      where subscription.id = v_subscription.id;
      v_subscription.status := 'past_due';
    elsif v_provider_status = 'paused' then
      update public.business_owner_subscriptions as subscription
      set
        provider_customer_id = coalesce(v_provider_customer_id, subscription.provider_customer_id),
        provider_plan_id = v_provider_plan_id,
        status = 'past_due',
        current_period_start = coalesce(p_current_period_start, subscription.current_period_start),
        current_period_end = coalesce(p_current_period_end, subscription.current_period_end),
        grace_period_end = null,
        creation_attempt_id = null,
        creation_started_at = null
      where subscription.id = v_subscription.id;
      v_subscription.status := 'past_due';
    elsif v_provider_status = 'cancelled' then
      update public.business_owner_subscriptions as subscription
      set
        provider_customer_id = coalesce(v_provider_customer_id, subscription.provider_customer_id),
        provider_plan_id = v_provider_plan_id,
        status = 'canceled',
        current_period_start = coalesce(p_current_period_start, subscription.current_period_start),
        current_period_end = coalesce(p_current_period_end, subscription.current_period_end),
        cancel_at_period_end = false,
        grace_period_end = null,
        canceled_at = coalesce(p_ended_at, pg_catalog.now()),
        ended_at = p_ended_at,
        creation_attempt_id = null,
        creation_started_at = null
      where subscription.id = v_subscription.id;
      v_subscription.status := 'canceled';
    else
      update public.business_owner_subscriptions as subscription
      set
        provider_customer_id = coalesce(v_provider_customer_id, subscription.provider_customer_id),
        provider_plan_id = v_provider_plan_id,
        status = 'expired',
        cancel_at_period_end = false,
        grace_period_end = null,
        ended_at = coalesce(p_ended_at, pg_catalog.now()),
        creation_attempt_id = null,
        creation_started_at = null
      where subscription.id = v_subscription.id;
      v_subscription.status := 'expired';
    end if;

    update public.subscription_webhook_events as event
    set
      processing_status = 'processed',
      processed_at = pg_catalog.now(),
      last_error = null
    where event.id = v_event.id;

    return query
    select
      'processed'::text,
      v_event.id,
      v_subscription.id,
      v_subscription.status,
      v_processing_attempts;
    return;
  exception
    when others then
      select subscription.status
      into v_current_internal_status
      from public.business_owner_subscriptions as subscription
      where subscription.id = v_subscription.id;

      update public.subscription_webhook_events as event
      set
        subscription_id = v_subscription.id,
        owner_id = v_subscription.owner_id,
        provider_customer_id = coalesce(v_provider_customer_id, event.provider_customer_id),
        provider_subscription_id = v_provider_subscription_id,
        processing_status = 'failed',
        processed_at = pg_catalog.now(),
        last_error = 'Webhook event processing failed.'
      where event.id = v_event.id;

      return query
      select
        'failed'::text,
        v_event.id,
        v_subscription.id,
        v_current_internal_status,
        v_processing_attempts;
      return;
  end;
end;
$$;

revoke all on function public.claim_razorpay_subscription_creation(uuid) from public;
revoke all on function public.claim_razorpay_subscription_creation(uuid) from anon;
revoke all on function public.claim_razorpay_subscription_creation(uuid) from authenticated;
grant execute on function public.claim_razorpay_subscription_creation(uuid) to service_role;

revoke all on function public.finalize_razorpay_subscription_creation(uuid, uuid, text, text) from public;
revoke all on function public.finalize_razorpay_subscription_creation(uuid, uuid, text, text) from anon;
revoke all on function public.finalize_razorpay_subscription_creation(uuid, uuid, text, text) from authenticated;
grant execute on function public.finalize_razorpay_subscription_creation(uuid, uuid, text, text) to service_role;

revoke all on function public.release_razorpay_subscription_creation(uuid, uuid) from public;
revoke all on function public.release_razorpay_subscription_creation(uuid, uuid) from anon;
revoke all on function public.release_razorpay_subscription_creation(uuid, uuid) from authenticated;
grant execute on function public.release_razorpay_subscription_creation(uuid, uuid) to service_role;

revoke all on function public.process_razorpay_subscription_webhook(
  text, text, timestamp with time zone, text, text, text, text,
  timestamp with time zone, timestamp with time zone, timestamp with time zone, jsonb
) from public;
revoke all on function public.process_razorpay_subscription_webhook(
  text, text, timestamp with time zone, text, text, text, text,
  timestamp with time zone, timestamp with time zone, timestamp with time zone, jsonb
) from anon;
revoke all on function public.process_razorpay_subscription_webhook(
  text, text, timestamp with time zone, text, text, text, text,
  timestamp with time zone, timestamp with time zone, timestamp with time zone, jsonb
) from authenticated;
grant execute on function public.process_razorpay_subscription_webhook(
  text, text, timestamp with time zone, text, text, text, text,
  timestamp with time zone, timestamp with time zone, timestamp with time zone, jsonb
) to service_role;

notify pgrst, 'reload schema';
