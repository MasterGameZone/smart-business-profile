-- Phase 1 payment monitoring foundation.
-- This migration is observational only: it records sanitized incidents and
-- never mutates subscription lifecycle, webhook, reconciliation, or entitlement data.

create table public.payment_monitoring_incidents (
  id uuid primary key default gen_random_uuid(),
  incident_key text not null,
  incident_type text not null,
  severity text not null,
  status text not null default 'open',
  source_table text not null,
  source_record_id text not null,
  owner_id uuid,
  provider_subscription_id text,
  provider_event_id text,
  diagnostic_code text,
  first_detected_at timestamp with time zone not null,
  last_detected_at timestamp with time zone not null,
  detection_count integer not null default 1,
  resolved_at timestamp with time zone,
  resolution_summary text,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint payment_monitoring_incidents_incident_key_check check (
    char_length(btrim(incident_key)) > 0
  ),
  constraint payment_monitoring_incidents_incident_type_check check (
    char_length(btrim(incident_type)) > 0
  ),
  constraint payment_monitoring_incidents_severity_check check (
    severity in ('warning', 'high', 'critical')
  ),
  constraint payment_monitoring_incidents_status_check check (
    status in ('open', 'resolved')
  ),
  constraint payment_monitoring_incidents_source_table_check check (
    char_length(btrim(source_table)) > 0
  ),
  constraint payment_monitoring_incidents_source_record_id_check check (
    char_length(btrim(source_record_id)) > 0
  ),
  constraint payment_monitoring_incidents_diagnostic_code_check check (
    diagnostic_code is null or char_length(btrim(diagnostic_code)) > 0
  ),
  constraint payment_monitoring_incidents_detection_count_check check (
    detection_count >= 1
  ),
  constraint payment_monitoring_incidents_detection_window_check check (
    last_detected_at >= first_detected_at
  ),
  constraint payment_monitoring_incidents_resolution_check check (
    (status = 'open' and resolved_at is null)
    or (status = 'resolved' and resolved_at is not null)
  )
);

create unique index payment_monitoring_incidents_open_key_idx
on public.payment_monitoring_incidents (incident_key)
where status = 'open';

create index payment_monitoring_incidents_open_severity_first_detected_idx
on public.payment_monitoring_incidents (severity, first_detected_at)
where status = 'open';

create index payment_monitoring_incidents_type_status_idx
on public.payment_monitoring_incidents (incident_type, status);

create index payment_monitoring_incidents_owner_id_idx
on public.payment_monitoring_incidents (owner_id)
where owner_id is not null;

create index payment_monitoring_incidents_provider_subscription_id_idx
on public.payment_monitoring_incidents (provider_subscription_id)
where provider_subscription_id is not null;

create index payment_monitoring_incidents_provider_event_id_idx
on public.payment_monitoring_incidents (provider_event_id)
where provider_event_id is not null;

create index payment_monitoring_incidents_last_detected_at_idx
on public.payment_monitoring_incidents (last_detected_at);

create trigger set_payment_monitoring_incidents_updated_at
before update on public.payment_monitoring_incidents
for each row
execute function public.set_subscription_updated_at();

alter table public.payment_monitoring_incidents enable row level security;

revoke all on table public.payment_monitoring_incidents from public, anon, authenticated;
grant select, insert, update on table public.payment_monitoring_incidents to service_role;

create function public.record_payment_monitoring_incident(
  p_incident_type text,
  p_severity text,
  p_source_table text,
  p_source_record_id text,
  p_owner_id uuid,
  p_provider_subscription_id text,
  p_provider_event_id text,
  p_diagnostic_code text,
  p_observed_at timestamp with time zone
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_incident_key text;
  v_incident_id uuid;
begin
  if nullif(pg_catalog.btrim(p_incident_type), '') is null
    or p_severity not in ('warning', 'high', 'critical')
    or nullif(pg_catalog.btrim(p_source_table), '') is null
    or nullif(pg_catalog.btrim(p_source_record_id), '') is null
    or p_observed_at is null then
    raise exception using
      errcode = '22023',
      message = 'Invalid payment monitoring incident data.';
  end if;

  if p_diagnostic_code is not null
    and nullif(pg_catalog.btrim(p_diagnostic_code), '') is null then
    raise exception using
      errcode = '22023',
      message = 'Invalid payment monitoring diagnostic code.';
  end if;

  v_incident_key := pg_catalog.concat_ws(
    ':',
    pg_catalog.btrim(p_incident_type),
    pg_catalog.btrim(p_source_table),
    pg_catalog.btrim(p_source_record_id)
  );

  insert into public.payment_monitoring_incidents (
    incident_key,
    incident_type,
    severity,
    source_table,
    source_record_id,
    owner_id,
    provider_subscription_id,
    provider_event_id,
    diagnostic_code,
    first_detected_at,
    last_detected_at,
    detection_count
  )
  values (
    v_incident_key,
    pg_catalog.btrim(p_incident_type),
    p_severity,
    pg_catalog.btrim(p_source_table),
    pg_catalog.btrim(p_source_record_id),
    p_owner_id,
    nullif(pg_catalog.btrim(p_provider_subscription_id), ''),
    nullif(pg_catalog.btrim(p_provider_event_id), ''),
    nullif(pg_catalog.btrim(p_diagnostic_code), ''),
    p_observed_at,
    p_observed_at,
    1
  )
  on conflict (incident_key) where status = 'open' do update
  set
    severity = case
      when payment_monitoring_incidents.severity = 'critical'
        or excluded.severity = 'critical' then 'critical'
      when payment_monitoring_incidents.severity = 'high'
        or excluded.severity = 'high' then 'high'
      else 'warning'
    end,
    last_detected_at = greatest(
      payment_monitoring_incidents.last_detected_at,
      excluded.last_detected_at
    ),
    detection_count = payment_monitoring_incidents.detection_count + 1,
    owner_id = coalesce(payment_monitoring_incidents.owner_id, excluded.owner_id),
    provider_subscription_id = coalesce(
      payment_monitoring_incidents.provider_subscription_id,
      excluded.provider_subscription_id
    ),
    provider_event_id = coalesce(
      payment_monitoring_incidents.provider_event_id,
      excluded.provider_event_id
    ),
    diagnostic_code = coalesce(
      excluded.diagnostic_code,
      payment_monitoring_incidents.diagnostic_code
    )
  returning id into v_incident_id;

  return v_incident_id;
end;
$$;

create function public.detect_payment_monitoring_incidents(
  p_observed_at timestamp with time zone default now()
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row record;
  v_count integer := 0;
begin
  if p_observed_at is null then
    raise exception using
      errcode = '22023',
      message = 'Observation time is required.';
  end if;

  -- Correlation failures are separated from generic failed processing so the
  -- same source row does not produce two incidents for the same root cause.
  for v_row in
    select
      event.id,
      event.owner_id,
      event.provider_subscription_id,
      event.provider_event_id,
      event.payload ->> 'source' as payload_source
    from public.subscription_webhook_events as event
    where event.billing_provider = 'razorpay'
      and event.processing_status = 'failed'
      and event.subscription_id is null
      and not exists (
        select 1
        from public.business_owner_subscriptions as subscription
        where subscription.billing_provider = 'razorpay'
          and subscription.provider_subscription_id = event.provider_subscription_id
      )
  loop
    perform public.record_payment_monitoring_incident(
      case when v_row.payload_source = 'provider_api_reconciliation'
        then 'reconciliation_processing_failure'
        else 'webhook_correlation_failure'
      end,
      'critical',
      'subscription_webhook_events',
      v_row.id::text,
      v_row.owner_id,
      v_row.provider_subscription_id,
      v_row.provider_event_id,
      case when v_row.payload_source = 'provider_api_reconciliation'
        then 'reconciliation_correlation_failed'
        else 'webhook_correlation_failed'
      end,
      p_observed_at
    );
    v_count := v_count + 1;
  end loop;

  -- Failed webhook processing and repeated attempts are detected from the
  -- explicit audit status/attempt fields; the stored provider error is never copied.
  for v_row in
    select
      event.id,
      event.owner_id,
      event.provider_subscription_id,
      event.provider_event_id,
      event.processing_attempts,
      event.payload ->> 'source' as payload_source
    from public.subscription_webhook_events as event
    where event.billing_provider = 'razorpay'
      and (event.processing_status = 'failed' or event.last_error is not null)
      and not (
        event.subscription_id is null
        and not exists (
          select 1
          from public.business_owner_subscriptions as subscription
          where subscription.billing_provider = 'razorpay'
            and subscription.provider_subscription_id = event.provider_subscription_id
        )
      )
  loop
    if v_row.payload_source = 'provider_api_reconciliation' then
      perform public.record_payment_monitoring_incident(
        'reconciliation_processing_failure',
        case when v_row.processing_attempts >= 3 then 'critical' else 'high' end,
        'subscription_webhook_events',
        v_row.id::text,
        v_row.owner_id,
        v_row.provider_subscription_id,
        v_row.provider_event_id,
        case when v_row.processing_attempts >= 3
          then 'reconciliation_repeated_attempts'
          else 'reconciliation_processing_failed'
        end,
        p_observed_at
      );
    else
      perform public.record_payment_monitoring_incident(
        'webhook_processing_failure',
        case when v_row.processing_attempts >= 3 then 'critical' else 'high' end,
        'subscription_webhook_events',
        v_row.id::text,
        v_row.owner_id,
        v_row.provider_subscription_id,
        v_row.provider_event_id,
        case when v_row.processing_attempts >= 3
          then 'webhook_repeated_attempts'
          else 'webhook_processing_failed'
        end,
        p_observed_at
      );
    end if;
    v_count := v_count + 1;
  end loop;

  -- A received audit row with no processed/ignored result after the documented
  -- default observation window is actionable, without inspecting its payload.
  for v_row in
    select
      event.id,
      event.owner_id,
      event.provider_subscription_id,
      event.provider_event_id,
      event.payload ->> 'source' as payload_source
    from public.subscription_webhook_events as event
    where event.billing_provider = 'razorpay'
      and event.processing_status = 'received'
      and event.processed_at is null
      and event.received_at <= p_observed_at - interval '15 minutes'
  loop
    perform public.record_payment_monitoring_incident(
      case when v_row.payload_source = 'provider_api_reconciliation'
        then 'reconciliation_processing_failure'
        else 'webhook_processing_failure'
      end,
      'high',
      'subscription_webhook_events',
      v_row.id::text,
      v_row.owner_id,
      v_row.provider_subscription_id,
      v_row.provider_event_id,
      case when v_row.payload_source = 'provider_api_reconciliation'
        then 'reconciliation_unprocessed'
        else 'webhook_unprocessed'
      end,
      p_observed_at
    );
    v_count := v_count + 1;
  end loop;

  -- Five minutes is the authoritative creation lease window used by the claim RPC.
  for v_row in
    select
      subscription.id,
      subscription.owner_id,
      subscription.provider_subscription_id,
      subscription.creation_attempt_id
    from public.business_owner_subscriptions as subscription
    where subscription.creation_attempt_id is not null
      and subscription.creation_started_at <= p_observed_at - interval '5 minutes'
  loop
    perform public.record_payment_monitoring_incident(
      'subscription_creation_lease',
      'high',
      'business_owner_subscriptions',
      v_row.id::text,
      v_row.owner_id,
      v_row.provider_subscription_id,
      null,
      'subscription_creation_lease_stale',
      p_observed_at
    );
    v_count := v_count + 1;
  end loop;

  -- updated_at is the best available lifecycle timestamp when no creation
  -- timestamp exists. Rows with an active creation lease are handled above.
  for v_row in
    select
      subscription.id,
      subscription.owner_id,
      subscription.provider_subscription_id
    from public.business_owner_subscriptions as subscription
    where subscription.status = 'incomplete'
      and subscription.provider_subscription_id is null
      and subscription.creation_attempt_id is null
      and coalesce(subscription.updated_at, subscription.created_at)
        <= p_observed_at - interval '30 minutes'
  loop
    perform public.record_payment_monitoring_incident(
      'subscription_incomplete_stale',
      'high',
      'business_owner_subscriptions',
      v_row.id::text,
      v_row.owner_id,
      null,
      null,
      'subscription_incomplete_stale',
      p_observed_at
    );
    v_count := v_count + 1;
  end loop;

  -- A provider subscription exists while the internal row remains incomplete
  -- beyond the same 30-minute preactivation observation window.
  for v_row in
    select
      subscription.id,
      subscription.owner_id,
      subscription.provider_subscription_id
    from public.business_owner_subscriptions as subscription
    where subscription.status = 'incomplete'
      and nullif(pg_catalog.btrim(subscription.provider_subscription_id), '') is not null
      and coalesce(subscription.updated_at, subscription.created_at)
        <= p_observed_at - interval '30 minutes'
  loop
    perform public.record_payment_monitoring_incident(
      'provider_subscription_not_activated',
      'critical',
      'business_owner_subscriptions',
      v_row.id::text,
      v_row.owner_id,
      v_row.provider_subscription_id,
      null,
      'provider_subscription_not_activated',
      p_observed_at
    );
    v_count := v_count + 1;
  end loop;

  -- The repository has no separate reconciliation-required state or audit
  -- table. Reconciliation failures are mapped to webhook audit rows above.
  for v_row in
    select
      subscription.id,
      subscription.owner_id,
      subscription.provider_subscription_id
    from public.business_owner_subscriptions as subscription
    where subscription.status = 'past_due'
      and subscription.grace_period_end is not null
      and subscription.grace_period_end <= p_observed_at
  loop
    perform public.record_payment_monitoring_incident(
      'subscription_grace_period',
      'critical',
      'business_owner_subscriptions',
      v_row.id::text,
      v_row.owner_id,
      v_row.provider_subscription_id,
      null,
      'subscription_grace_period_expired',
      p_observed_at
    );
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

create function public.resolve_payment_monitoring_incident(
  p_incident_id uuid,
  p_resolution_summary text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status text;
begin
  if p_incident_id is null
    or nullif(pg_catalog.btrim(p_resolution_summary), '') is null then
    raise exception using
      errcode = '22023',
      message = 'A sanitized resolution summary is required.';
  end if;

  update public.payment_monitoring_incidents as incident
  set
    status = 'resolved',
    resolved_at = coalesce(incident.resolved_at, pg_catalog.now()),
    resolution_summary = pg_catalog.btrim(p_resolution_summary)
  where incident.id = p_incident_id
    and incident.status = 'open'
  returning incident.status into v_status;

  if found then
    return true;
  end if;

  select incident.status
  into v_status
  from public.payment_monitoring_incidents as incident
  where incident.id = p_incident_id;

  return v_status = 'resolved';
end;
$$;

revoke all on function public.record_payment_monitoring_incident(
  text, text, text, text, uuid, text, text, text, timestamp with time zone
) from public, anon, authenticated;
revoke all on function public.detect_payment_monitoring_incidents(timestamp with time zone)
  from public, anon, authenticated;
revoke all on function public.resolve_payment_monitoring_incident(uuid, text)
  from public, anon, authenticated;

grant execute on function public.record_payment_monitoring_incident(
  text, text, text, text, uuid, text, text, text, timestamp with time zone
) to service_role;
grant execute on function public.detect_payment_monitoring_incidents(timestamp with time zone)
  to service_role;
grant execute on function public.resolve_payment_monitoring_incident(uuid, text)
  to service_role;

notify pgrst, 'reload schema';
