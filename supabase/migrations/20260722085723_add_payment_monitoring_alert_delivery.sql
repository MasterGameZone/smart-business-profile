-- Phase 3 payment-monitoring alert delivery.
-- This migration adds only an internal, sanitized email-delivery outbox. It
-- never changes payment lifecycle, entitlement, webhook, reconciliation, or
-- incident-resolution behavior.

create extension if not exists pg_net with schema extensions;

create table public.payment_monitoring_alert_deliveries (
  id uuid primary key default gen_random_uuid(),
  incident_id uuid not null references public.payment_monitoring_incidents(id),
  channel text not null default 'email',
  alert_severity text not null,
  delivery_key text not null,
  status text not null default 'pending',
  attempt_count integer not null default 0,
  max_attempts integer not null default 5,
  available_at timestamp with time zone not null default now(),
  claim_token uuid,
  claim_started_at timestamp with time zone,
  claim_expires_at timestamp with time zone,
  last_attempt_at timestamp with time zone,
  provider_message_id text,
  last_error_code text,
  sent_at timestamp with time zone,
  failed_at timestamp with time zone,
  suppressed_at timestamp with time zone,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  finalized_claim_token uuid,
  constraint payment_monitoring_alert_deliveries_channel_check check (
    channel = 'email'
  ),
  constraint payment_monitoring_alert_deliveries_severity_check check (
    alert_severity in ('high', 'critical')
  ),
  constraint payment_monitoring_alert_deliveries_status_check check (
    status in ('pending', 'processing', 'retry_scheduled', 'sent', 'failed', 'suppressed')
  ),
  constraint payment_monitoring_alert_deliveries_key_check check (
    char_length(btrim(delivery_key)) > 0
  ),
  constraint payment_monitoring_alert_deliveries_attempt_count_check check (
    attempt_count >= 0 and attempt_count <= max_attempts
  ),
  constraint payment_monitoring_alert_deliveries_max_attempts_check check (
    max_attempts >= 1
  ),
  constraint payment_monitoring_alert_deliveries_provider_id_check check (
    provider_message_id is null or char_length(btrim(provider_message_id)) > 0
  ),
  constraint payment_monitoring_alert_deliveries_error_code_check check (
    last_error_code is null or last_error_code ~ '^[a-z][a-z0-9_]{0,63}$'
  ),
  constraint payment_monitoring_alert_deliveries_claim_check check (
    (status = 'processing'
      and claim_token is not null
      and claim_started_at is not null
      and claim_expires_at is not null)
    or (status <> 'processing'
      and claim_token is null
      and claim_started_at is null
      and claim_expires_at is null)
  ),
  constraint payment_monitoring_alert_deliveries_claim_window_check check (
    (claim_started_at is null and claim_expires_at is null)
    or claim_expires_at > claim_started_at
  ),
  constraint payment_monitoring_alert_deliveries_terminal_timestamps_check check (
    (status = 'sent' and sent_at is not null and failed_at is null and suppressed_at is null)
    or (status = 'failed' and sent_at is null and failed_at is not null and suppressed_at is null)
    or (status = 'suppressed' and sent_at is null and failed_at is null and suppressed_at is not null)
    or (status in ('pending', 'processing', 'retry_scheduled')
      and sent_at is null
      and failed_at is null
      and suppressed_at is null)
  )
);

create unique index payment_monitoring_alert_deliveries_delivery_key_uidx
on public.payment_monitoring_alert_deliveries (delivery_key);

create index payment_monitoring_alert_deliveries_due_idx
on public.payment_monitoring_alert_deliveries (available_at, id)
where status in ('pending', 'retry_scheduled');

create index payment_monitoring_alert_deliveries_processing_lease_idx
on public.payment_monitoring_alert_deliveries (claim_expires_at, id)
where status = 'processing';

create index payment_monitoring_alert_deliveries_incident_id_idx
on public.payment_monitoring_alert_deliveries (incident_id);

create index payment_monitoring_alert_deliveries_status_created_idx
on public.payment_monitoring_alert_deliveries (status, created_at desc);

create index payment_monitoring_alert_deliveries_sent_at_idx
on public.payment_monitoring_alert_deliveries (sent_at)
where sent_at is not null;

create index payment_monitoring_alert_deliveries_failed_at_idx
on public.payment_monitoring_alert_deliveries (failed_at)
where failed_at is not null;

create trigger set_payment_monitoring_alert_deliveries_updated_at
before update on public.payment_monitoring_alert_deliveries
for each row
execute function public.set_subscription_updated_at();

alter table public.payment_monitoring_alert_deliveries enable row level security;

revoke all on table public.payment_monitoring_alert_deliveries from public, anon, authenticated;

create function public.enqueue_payment_monitoring_alert_deliveries(
  p_observed_at timestamp with time zone default now()
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_enqueued integer := 0;
  v_eligible integer := 0;
  v_suppressed integer := 0;
begin
  if p_observed_at is null then
    raise exception using errcode = '22023', message = 'Observation time is required.';
  end if;

  update public.payment_monitoring_alert_deliveries as delivery
  set
    status = 'suppressed',
    suppressed_at = p_observed_at,
    updated_at = p_observed_at,
    claim_token = null,
    claim_started_at = null,
    claim_expires_at = null,
    finalized_claim_token = null
  from public.payment_monitoring_incidents as incident
  where delivery.incident_id = incident.id
    and delivery.status in ('pending', 'retry_scheduled')
    and incident.status = 'resolved';

  get diagnostics v_suppressed = row_count;

  select count(*)::integer
  into v_eligible
  from public.payment_monitoring_incidents as incident
  where incident.status = 'open'
    and incident.severity in ('high', 'critical');

  insert into public.payment_monitoring_alert_deliveries (
    incident_id,
    alert_severity,
    delivery_key,
    available_at
  )
  select
    incident.id,
    incident.severity,
    pg_catalog.concat(
      'payment-monitoring-email:',
      incident.id::text,
      ':',
      incident.severity
    ),
    p_observed_at
  from public.payment_monitoring_incidents as incident
  where incident.status = 'open'
    and incident.severity in ('high', 'critical')
  on conflict (delivery_key) do nothing;

  get diagnostics v_enqueued = row_count;

  return pg_catalog.jsonb_build_object(
    'observed_at', p_observed_at,
    'eligible_incidents', v_eligible,
    'enqueued', v_enqueued,
    'suppressed', v_suppressed
  );
end;
$$;

create function public.claim_payment_monitoring_alert_deliveries(
  p_max_batch_size integer default 10,
  p_observed_at timestamp with time zone default now(),
  p_lease_seconds integer default 300
)
returns table (
  delivery_id uuid,
  claim_token uuid,
  delivery_key text,
  incident_id uuid,
  incident_type text,
  alert_severity text,
  diagnostic_code text,
  source_table text,
  source_record_id text,
  first_detected_at timestamp with time zone,
  last_detected_at timestamp with time zone,
  detection_count integer,
  provider_subscription_id text,
  provider_event_id text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_batch_size integer;
begin
  if p_observed_at is null then
    raise exception using errcode = '22023', message = 'Observation time is required.';
  end if;

  if p_lease_seconds is null or p_lease_seconds < 60 or p_lease_seconds > 3600 then
    raise exception using errcode = '22023', message = 'Claim lease is outside the permitted range.';
  end if;

  v_batch_size := coalesce(p_max_batch_size, 10);
  if v_batch_size < 1 then
    v_batch_size := 1;
  elsif v_batch_size > 10 then
    v_batch_size := 10;
  end if;

  update public.payment_monitoring_alert_deliveries as delivery
  set
    status = case
      when delivery.attempt_count < delivery.max_attempts then 'retry_scheduled'
      else 'failed'
    end,
    available_at = case
      when delivery.attempt_count < delivery.max_attempts then p_observed_at
      else delivery.available_at
    end,
    last_error_code = 'delivery_claim_expired',
    failed_at = case
      when delivery.attempt_count < delivery.max_attempts then null
      else p_observed_at
    end,
    finalized_claim_token = null,
    claim_token = null,
    claim_started_at = null,
    claim_expires_at = null,
    updated_at = p_observed_at
  where delivery.status = 'processing'
    and delivery.claim_expires_at <= p_observed_at;

  update public.payment_monitoring_alert_deliveries as delivery
  set
    status = 'suppressed',
    suppressed_at = p_observed_at,
    updated_at = p_observed_at,
    claim_token = null,
    claim_started_at = null,
    claim_expires_at = null,
    finalized_claim_token = null
  from public.payment_monitoring_incidents as incident
  where delivery.incident_id = incident.id
    and delivery.status in ('pending', 'retry_scheduled')
    and incident.status = 'resolved';

  return query
  with claim_candidates as (
    select delivery.id
    from public.payment_monitoring_alert_deliveries as delivery
    join public.payment_monitoring_incidents as incident
      on incident.id = delivery.incident_id
    where delivery.status in ('pending', 'retry_scheduled')
      and delivery.available_at <= p_observed_at
      and incident.status = 'open'
    order by delivery.available_at, delivery.created_at, delivery.id
    for update of delivery skip locked
    limit v_batch_size
  )
  update public.payment_monitoring_alert_deliveries as delivery
  set
    status = 'processing',
    claim_token = pg_catalog.gen_random_uuid(),
    claim_started_at = p_observed_at,
    claim_expires_at = p_observed_at + pg_catalog.make_interval(secs => p_lease_seconds),
    attempt_count = delivery.attempt_count + 1,
    last_attempt_at = p_observed_at,
    last_error_code = null,
    finalized_claim_token = null,
    updated_at = p_observed_at
  from claim_candidates as candidate,
    public.payment_monitoring_incidents as incident
  where delivery.id = candidate.id
    and incident.id = delivery.incident_id
  returning
    delivery.id,
    delivery.claim_token,
    delivery.delivery_key,
    delivery.incident_id,
    incident.incident_type,
    delivery.alert_severity,
    incident.diagnostic_code,
    incident.source_table,
    incident.source_record_id,
    incident.first_detected_at,
    incident.last_detected_at,
    incident.detection_count,
    incident.provider_subscription_id,
    incident.provider_event_id;
end;
$$;

create function public.mark_payment_monitoring_alert_delivery_sent(
  p_delivery_id uuid,
  p_claim_token uuid,
  p_observed_at timestamp with time zone,
  p_provider_message_id text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status text;
  v_provider_message_id text;
  v_finalized_claim_token uuid;
begin
  if p_delivery_id is null
    or p_claim_token is null
    or p_observed_at is null
    or p_provider_message_id is null
    or p_provider_message_id !~ '^[A-Za-z0-9_-]{1,200}$' then
    raise exception using errcode = '22023', message = 'Invalid alert-delivery completion data.';
  end if;

  select delivery.status, delivery.provider_message_id, delivery.finalized_claim_token
  into v_status, v_provider_message_id, v_finalized_claim_token
  from public.payment_monitoring_alert_deliveries as delivery
  where delivery.id = p_delivery_id;

  if v_status = 'sent' then
    if v_provider_message_id = p_provider_message_id
      and v_finalized_claim_token = p_claim_token then
      return true;
    end if;
    raise exception using errcode = '23514', message = 'Conflicting provider message ID.';
  end if;

  if v_status <> 'processing'
    or not exists (
      select 1
      from public.payment_monitoring_alert_deliveries as delivery
      where delivery.id = p_delivery_id
        and delivery.status = 'processing'
        and delivery.claim_token = p_claim_token
    ) then
    raise exception using errcode = '42501', message = 'Alert-delivery claim is stale or invalid.';
  end if;

  update public.payment_monitoring_alert_deliveries as delivery
  set
    status = 'sent',
    provider_message_id = p_provider_message_id,
    sent_at = p_observed_at,
    updated_at = p_observed_at,
    claim_token = null,
    claim_started_at = null,
    claim_expires_at = null,
    finalized_claim_token = p_claim_token
  where delivery.id = p_delivery_id
    and delivery.status = 'processing'
    and delivery.claim_token = p_claim_token;

  return found;
end;
$$;

create function public.mark_payment_monitoring_alert_delivery_failed(
  p_delivery_id uuid,
  p_claim_token uuid,
  p_observed_at timestamp with time zone,
  p_error_code text,
  p_retryable boolean
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status text;
  v_last_error_code text;
  v_finalized_claim_token uuid;
  v_is_retry boolean;
begin
  if p_delivery_id is null
    or p_claim_token is null
    or p_observed_at is null
    or p_retryable is null
    or p_error_code is null
    or p_error_code !~ '^[a-z][a-z0-9_]{0,63}$' then
    raise exception using errcode = '22023', message = 'Invalid alert-delivery failure data.';
  end if;

  select delivery.status, delivery.last_error_code, delivery.finalized_claim_token
  into v_status, v_last_error_code, v_finalized_claim_token
  from public.payment_monitoring_alert_deliveries as delivery
  where delivery.id = p_delivery_id;

  if v_status in ('retry_scheduled', 'failed')
    and v_last_error_code = p_error_code
    and v_finalized_claim_token = p_claim_token then
    return true;
  end if;

  if v_status <> 'processing'
    or not exists (
      select 1
      from public.payment_monitoring_alert_deliveries as delivery
      where delivery.id = p_delivery_id
        and delivery.status = 'processing'
        and delivery.claim_token = p_claim_token
    ) then
    raise exception using errcode = '42501', message = 'Alert-delivery claim is stale or invalid.';
  end if;

  v_is_retry := p_retryable and (
    (select delivery.attempt_count from public.payment_monitoring_alert_deliveries as delivery where delivery.id = p_delivery_id)
      < (select delivery.max_attempts from public.payment_monitoring_alert_deliveries as delivery where delivery.id = p_delivery_id)
  );

  update public.payment_monitoring_alert_deliveries as delivery
  set
    status = case when v_is_retry then 'retry_scheduled' else 'failed' end,
    available_at = case
      when not v_is_retry then delivery.available_at
      when delivery.attempt_count = 1 then p_observed_at + interval '5 minutes'
      when delivery.attempt_count = 2 then p_observed_at + interval '15 minutes'
      when delivery.attempt_count = 3 then p_observed_at + interval '30 minutes'
      else p_observed_at + interval '60 minutes'
    end,
    last_error_code = p_error_code,
    failed_at = case when v_is_retry then null else p_observed_at end,
    finalized_claim_token = p_claim_token,
    updated_at = p_observed_at,
    claim_token = null,
    claim_started_at = null,
    claim_expires_at = null
  where delivery.id = p_delivery_id
    and delivery.status = 'processing'
    and delivery.claim_token = p_claim_token;

  return found;
end;
$$;

create function public.invoke_payment_monitoring_alert_delivery()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_function_url text;
  v_cron_secret text;
  v_request_id bigint;
begin
  select
    max(case when secret.name = 'payment_monitoring_alert_function_url' then secret.decrypted_secret end),
    max(case when secret.name = 'payment_monitoring_alert_cron_secret' then secret.decrypted_secret end)
  into v_function_url, v_cron_secret
  from vault.decrypted_secrets as secret
  where secret.name in (
    'payment_monitoring_alert_function_url',
    'payment_monitoring_alert_cron_secret'
  );

  if nullif(pg_catalog.btrim(v_function_url), '') is null
    or nullif(v_cron_secret, '') is null then
    return pg_catalog.jsonb_build_object('status', 'not_configured');
  end if;

  select net.http_post(
    url := v_function_url,
    body := '{}'::jsonb,
    headers := pg_catalog.jsonb_build_object(
      'Content-Type', 'application/json',
      'x-payment-monitoring-cron-secret', v_cron_secret
    ),
    timeout_milliseconds := 5000
  )
  into v_request_id;

  return pg_catalog.jsonb_build_object(
    'status', 'requested',
    'request_id', v_request_id
  );
end;
$$;

revoke all on function public.enqueue_payment_monitoring_alert_deliveries(timestamp with time zone)
  from public, anon, authenticated;
revoke all on function public.claim_payment_monitoring_alert_deliveries(integer, timestamp with time zone, integer)
  from public, anon, authenticated;
revoke all on function public.mark_payment_monitoring_alert_delivery_sent(uuid, uuid, timestamp with time zone, text)
  from public, anon, authenticated;
revoke all on function public.mark_payment_monitoring_alert_delivery_failed(uuid, uuid, timestamp with time zone, text, boolean)
  from public, anon, authenticated;
revoke all on function public.invoke_payment_monitoring_alert_delivery()
  from public, anon, authenticated;

grant execute on function public.enqueue_payment_monitoring_alert_deliveries(timestamp with time zone)
  to service_role, postgres;
grant execute on function public.claim_payment_monitoring_alert_deliveries(integer, timestamp with time zone, integer)
  to service_role, postgres;
grant execute on function public.mark_payment_monitoring_alert_delivery_sent(uuid, uuid, timestamp with time zone, text)
  to service_role, postgres;
grant execute on function public.mark_payment_monitoring_alert_delivery_failed(uuid, uuid, timestamp with time zone, text, boolean)
  to service_role, postgres;
grant execute on function public.invoke_payment_monitoring_alert_delivery()
  to service_role, postgres;

do $$
begin
  -- Scheduling the stable name is idempotent and leaves the Phase 2 detector
  -- job and every unrelated Cron job unchanged.
  perform cron.schedule(
    'payment-monitoring-alert-delivery',
    '2-59/5 * * * *',
    'select public.invoke_payment_monitoring_alert_delivery();'
  );
end;
$$;

notify pgrst, 'reload schema';
