-- Phase 4 payment-monitoring operational visibility.
-- This migration is observability-only. It never changes payment lifecycle,
-- entitlement, webhook, reconciliation, or incident-detection behavior.

create table public.payment_monitoring_alert_invocations (
  id uuid primary key default gen_random_uuid(),
  pg_net_request_id bigint,
  status text not null default 'queued',
  invoked_at timestamp with time zone not null default now(),
  started_at timestamp with time zone,
  completed_at timestamp with time zone,
  http_status integer,
  enqueued_count integer not null default 0,
  claimed_count integer not null default 0,
  sent_count integer not null default 0,
  retry_scheduled_count integer not null default 0,
  failed_count integer not null default 0,
  suppressed_count integer not null default 0,
  diagnostic_code text,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint payment_monitoring_alert_invocations_status_check check (
    status in ('queued', 'running', 'succeeded', 'failed', 'not_configured')
  ),
  constraint payment_monitoring_alert_invocations_http_status_check check (
    http_status is null or (http_status between 100 and 599)
  ),
  constraint payment_monitoring_alert_invocations_counts_check check (
    enqueued_count >= 0
    and claimed_count >= 0
    and sent_count >= 0
    and retry_scheduled_count >= 0
    and failed_count >= 0
    and suppressed_count >= 0
  ),
  constraint payment_monitoring_alert_invocations_diagnostic_check check (
    diagnostic_code is null or diagnostic_code ~ '^[a-z][a-z0-9_]{0,63}$'
  )
);

create unique index payment_monitoring_alert_invocations_request_uidx
on public.payment_monitoring_alert_invocations (pg_net_request_id)
where pg_net_request_id is not null;

create index payment_monitoring_alert_invocations_status_invoked_idx
on public.payment_monitoring_alert_invocations (status, invoked_at desc, id desc);

create index payment_monitoring_alert_invocations_completed_idx
on public.payment_monitoring_alert_invocations (completed_at desc, id desc)
where completed_at is not null;

create trigger set_payment_monitoring_alert_invocations_updated_at
before update on public.payment_monitoring_alert_invocations
for each row
execute function public.set_subscription_updated_at();

alter table public.payment_monitoring_alert_invocations enable row level security;

revoke all on table public.payment_monitoring_alert_invocations from public, anon, authenticated;
grant select on table public.payment_monitoring_alert_invocations to service_role, postgres;

create function public.start_payment_monitoring_alert_invocation(
  p_invocation_id uuid,
  p_started_at timestamp with time zone default now()
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_invocation_id is null or p_started_at is null then
    raise exception using errcode = '22023', message = 'Invalid alert invocation data.';
  end if;

  update public.payment_monitoring_alert_invocations as invocation
  set
    status = 'running',
    started_at = coalesce(invocation.started_at, p_started_at),
    updated_at = p_started_at
  where invocation.id = p_invocation_id
    and invocation.status = 'queued';

  return found;
end;
$$;

create function public.mark_payment_monitoring_alert_invocation_succeeded(
  p_invocation_id uuid,
  p_completed_at timestamp with time zone,
  p_http_status integer default null,
  p_enqueued_count integer default 0,
  p_claimed_count integer default 0,
  p_sent_count integer default 0,
  p_retry_scheduled_count integer default 0,
  p_failed_count integer default 0,
  p_suppressed_count integer default 0
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_invocation_id is null
    or p_completed_at is null
    or p_http_status is not null and (p_http_status < 100 or p_http_status > 599)
    or p_enqueued_count is null or p_enqueued_count < 0
    or p_claimed_count is null or p_claimed_count < 0
    or p_sent_count is null or p_sent_count < 0
    or p_retry_scheduled_count is null or p_retry_scheduled_count < 0
    or p_failed_count is null or p_failed_count < 0
    or p_suppressed_count is null or p_suppressed_count < 0 then
    raise exception using errcode = '22023', message = 'Invalid alert invocation completion data.';
  end if;

  update public.payment_monitoring_alert_invocations as invocation
  set
    status = 'succeeded',
    completed_at = p_completed_at,
    http_status = p_http_status,
    enqueued_count = p_enqueued_count,
    claimed_count = p_claimed_count,
    sent_count = p_sent_count,
    retry_scheduled_count = p_retry_scheduled_count,
    failed_count = p_failed_count,
    suppressed_count = p_suppressed_count,
    diagnostic_code = null,
    updated_at = p_completed_at
  where invocation.id = p_invocation_id
    and invocation.status = 'running';

  return found;
end;
$$;

create function public.mark_payment_monitoring_alert_invocation_failed(
  p_invocation_id uuid,
  p_completed_at timestamp with time zone,
  p_diagnostic_code text,
  p_http_status integer default null
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_invocation_id is null
    or p_completed_at is null
    or p_diagnostic_code is null
    or p_diagnostic_code !~ '^[a-z][a-z0-9_]{0,63}$'
    or p_http_status is not null and (p_http_status < 100 or p_http_status > 599) then
    raise exception using errcode = '22023', message = 'Invalid alert invocation failure data.';
  end if;

  update public.payment_monitoring_alert_invocations as invocation
  set
    status = 'failed',
    completed_at = p_completed_at,
    http_status = p_http_status,
    diagnostic_code = p_diagnostic_code,
    updated_at = p_completed_at
  where invocation.id = p_invocation_id
    and invocation.status = 'running';

  return found;
end;
$$;

create or replace function public.invoke_payment_monitoring_alert_delivery()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_function_url text;
  v_cron_secret text;
  v_request_id bigint;
  v_invocation_id uuid := pg_catalog.gen_random_uuid();
  v_invoked_at timestamp with time zone := pg_catalog.now();
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
    insert into public.payment_monitoring_alert_invocations (
      id, status, invoked_at, completed_at, diagnostic_code
    )
    values (
      v_invocation_id, 'not_configured', v_invoked_at, v_invoked_at,
      'missing_vault_configuration'
    );

    return pg_catalog.jsonb_build_object(
      'status', 'not_configured',
      'invocation_id', v_invocation_id
    );
  end if;

  insert into public.payment_monitoring_alert_invocations (id, status, invoked_at)
  values (v_invocation_id, 'queued', v_invoked_at);

  begin
    select net.http_post(
      url := v_function_url,
      body := pg_catalog.jsonb_build_object('invocation_id', v_invocation_id::text),
      headers := pg_catalog.jsonb_build_object(
        'Content-Type', 'application/json',
        'x-payment-monitoring-cron-secret', v_cron_secret
      ),
      timeout_milliseconds := 5000
    )
    into v_request_id;

    update public.payment_monitoring_alert_invocations as invocation
    set
      pg_net_request_id = v_request_id,
      updated_at = v_invoked_at
    where invocation.id = v_invocation_id;

    return pg_catalog.jsonb_build_object(
      'status', 'requested',
      'invocation_id', v_invocation_id,
      'request_id', v_request_id
    );
  exception when others then
    update public.payment_monitoring_alert_invocations as invocation
    set
      status = 'failed',
      completed_at = pg_catalog.now(),
      diagnostic_code = 'pg_net_request_failed',
      updated_at = pg_catalog.now()
    where invocation.id = v_invocation_id;

    return pg_catalog.jsonb_build_object(
      'status', 'failed',
      'invocation_id', v_invocation_id,
      'diagnostic_code', 'pg_net_request_failed'
    );
  end;
end;
$$;

create view public.payment_monitoring_incident_operations
with (security_invoker = true)
as
select
  incident.id as incident_id,
  incident.incident_type,
  incident.severity,
  incident.status,
  incident.source_table,
  incident.source_record_id,
  incident.provider_subscription_id,
  incident.provider_event_id,
  incident.diagnostic_code,
  incident.first_detected_at,
  incident.last_detected_at,
  incident.detection_count,
  incident.resolved_at,
  incident.created_at,
  incident.updated_at,
  latest_delivery.delivery_id as latest_delivery_id,
  latest_delivery.alert_severity as latest_delivery_severity,
  latest_delivery.status as latest_delivery_status,
  latest_delivery.attempt_count as latest_delivery_attempt_count,
  latest_delivery.last_attempt_at as latest_delivery_last_attempt_at,
  latest_delivery.sent_at as latest_delivery_sent_at,
  latest_delivery.last_error_code as latest_delivery_error_code
from public.payment_monitoring_incidents as incident
left join lateral (
  select
    delivery.id as delivery_id,
    delivery.alert_severity,
    delivery.status,
    delivery.attempt_count,
    delivery.last_attempt_at,
    delivery.sent_at,
    delivery.last_error_code
  from public.payment_monitoring_alert_deliveries as delivery
  where delivery.incident_id = incident.id
  order by delivery.created_at desc, delivery.id desc
  limit 1
) as latest_delivery on true;

create view public.payment_monitoring_alert_delivery_operations
with (security_invoker = true)
as
select
  delivery.id as delivery_id,
  delivery.incident_id,
  incident.incident_type,
  incident.severity as incident_severity,
  incident.status as incident_status,
  delivery.channel,
  delivery.alert_severity,
  delivery.status,
  delivery.attempt_count,
  delivery.max_attempts,
  delivery.available_at,
  delivery.claim_started_at,
  delivery.claim_expires_at,
  delivery.last_attempt_at,
  delivery.last_error_code,
  delivery.sent_at,
  delivery.failed_at,
  delivery.suppressed_at,
  delivery.created_at,
  delivery.updated_at,
  delivery.status = 'processing'
    and delivery.claim_expires_at <= pg_catalog.now() as claim_is_stale
from public.payment_monitoring_alert_deliveries as delivery
join public.payment_monitoring_incidents as incident
  on incident.id = delivery.incident_id;

create function public.get_payment_monitoring_operational_health(
  p_observed_at timestamp with time zone default now()
)
returns jsonb
language plpgsql
security definer
stable
set search_path = ''
as $$
declare
  v_observed_at timestamp with time zone := coalesce(p_observed_at, pg_catalog.now());
  v_detector_job_count integer := 0;
  v_detector_job_valid_count integer := 0;
  v_alert_job_count integer := 0;
  v_alert_job_valid_count integer := 0;
  v_detector_last_success timestamp with time zone;
  v_alert_last_success timestamp with time zone;
  v_detector_recent_failures integer := 0;
  v_alert_recent_failures integer := 0;
  v_pg_net_failures integer := 0;
  v_alert_configured boolean := false;
  v_overdue_pending integer := 0;
  v_overdue_retries integer := 0;
  v_stale_claims integer := 0;
  v_terminal_failed integer := 0;
  v_pending integer := 0;
  v_retry_scheduled integer := 0;
  v_processing integer := 0;
  v_sent_24h integer := 0;
  v_failed_24h integer := 0;
  v_suppressed_24h integer := 0;
  v_open_incidents integer := 0;
  v_open_warning integer := 0;
  v_open_high integer := 0;
  v_open_critical integer := 0;
  v_oldest_open timestamp with time zone;
  v_incidents_created_24h integer := 0;
  v_incidents_resolved_24h integer := 0;
  v_system_health text;
  v_incident_health text;
  v_structural_critical boolean := false;
  v_detector_stale boolean := false;
  v_alert_stale boolean := false;
  v_isolated_failure boolean := false;
  v_has_temporary_backlog boolean := false;
begin
  if p_observed_at is null then
    raise exception using errcode = '22023', message = 'Observation time is required.';
  end if;

  select
    count(*)::integer,
    count(*) filter (
      where job.active
        and job.schedule = '*/5 * * * *'
        and job.command = 'select public.run_payment_monitoring_cycle();'
    )::integer
  into v_detector_job_count, v_detector_job_valid_count
  from cron.job as job
  where job.jobname = 'payment-monitoring-detection';

  select
    count(*)::integer,
    count(*) filter (
      where job.active
        and job.schedule = '2-59/5 * * * *'
        and job.command = 'select public.invoke_payment_monitoring_alert_delivery();'
    )::integer
  into v_alert_job_count, v_alert_job_valid_count
  from cron.job as job
  where job.jobname = 'payment-monitoring-alert-delivery';

  select count(*) = 2
  into v_alert_configured
  from vault.decrypted_secrets as secret
  where secret.name in (
    'payment_monitoring_alert_function_url',
    'payment_monitoring_alert_cron_secret'
  );

  select max(run.start_time)
  into v_detector_last_success
  from cron.job_run_details as run
  join cron.job as job on job.jobid = run.jobid
  where job.jobname = 'payment-monitoring-detection'
    and run.status = 'succeeded';

  select max(run.start_time)
  into v_alert_last_success
  from cron.job_run_details as run
  join cron.job as job on job.jobid = run.jobid
  where job.jobname = 'payment-monitoring-alert-delivery'
    and run.status = 'succeeded';

  select
    count(*) filter (where run.status <> 'succeeded')::integer
  into v_detector_recent_failures
  from cron.job_run_details as run
  join cron.job as job on job.jobid = run.jobid
  where job.jobname = 'payment-monitoring-detection'
    and run.start_time >= v_observed_at - interval '24 hours'
    and run.start_time <= v_observed_at;

  select
    count(*) filter (where run.status <> 'succeeded')::integer
  into v_alert_recent_failures
  from cron.job_run_details as run
  join cron.job as job on job.jobid = run.jobid
  where job.jobname = 'payment-monitoring-alert-delivery'
    and run.start_time >= v_observed_at - interval '24 hours'
    and run.start_time <= v_observed_at;

  select count(*)::integer
  into v_pg_net_failures
  from net._http_response as response
  join public.payment_monitoring_alert_invocations as invocation
    on invocation.pg_net_request_id = response.id
  where response.created >= v_observed_at - interval '24 hours'
    and response.created <= v_observed_at
    and (
      response.status_code is null
      or response.status_code < 200
      or response.status_code >= 300
      or response.timed_out
      or response.error_msg is not null
    );

  select
    count(*) filter (where delivery.status = 'pending')::integer,
    count(*) filter (where delivery.status = 'retry_scheduled')::integer,
    count(*) filter (where delivery.status = 'processing')::integer,
    count(*) filter (
      where delivery.status = 'pending'
        and delivery.available_at <= v_observed_at - interval '15 minutes'
    )::integer,
    count(*) filter (
      where delivery.status = 'retry_scheduled'
        and delivery.available_at <= v_observed_at - interval '15 minutes'
    )::integer,
    count(*) filter (
      where delivery.status = 'processing'
        and delivery.claim_expires_at <= v_observed_at
    )::integer,
    count(*) filter (
      where delivery.status = 'failed'
        and incident.status = 'open'
    )::integer,
    count(*) filter (
      where delivery.status = 'sent'
        and delivery.sent_at >= v_observed_at - interval '24 hours'
        and delivery.sent_at <= v_observed_at
    )::integer,
    count(*) filter (
      where delivery.status = 'failed'
        and delivery.failed_at >= v_observed_at - interval '24 hours'
        and delivery.failed_at <= v_observed_at
    )::integer,
    count(*) filter (
      where delivery.status = 'suppressed'
        and delivery.suppressed_at >= v_observed_at - interval '24 hours'
        and delivery.suppressed_at <= v_observed_at
    )::integer
  into
    v_pending, v_retry_scheduled, v_processing, v_overdue_pending,
    v_overdue_retries, v_stale_claims, v_terminal_failed, v_sent_24h,
    v_failed_24h, v_suppressed_24h
  from public.payment_monitoring_alert_deliveries as delivery
  join public.payment_monitoring_incidents as incident
    on incident.id = delivery.incident_id;

  select
    count(*) filter (where incident.status = 'open')::integer,
    count(*) filter (where incident.status = 'open' and incident.severity = 'warning')::integer,
    count(*) filter (where incident.status = 'open' and incident.severity = 'high')::integer,
    count(*) filter (where incident.status = 'open' and incident.severity = 'critical')::integer,
    min(incident.first_detected_at) filter (where incident.status = 'open'),
    count(*) filter (
      where incident.created_at >= v_observed_at - interval '24 hours'
        and incident.created_at <= v_observed_at
    )::integer,
    count(*) filter (
      where incident.resolved_at >= v_observed_at - interval '24 hours'
        and incident.resolved_at <= v_observed_at
    )::integer
  into
    v_open_incidents, v_open_warning, v_open_high, v_open_critical,
    v_oldest_open, v_incidents_created_24h, v_incidents_resolved_24h
  from public.payment_monitoring_incidents as incident;

  v_detector_stale := v_detector_last_success is null
    or v_detector_last_success < v_observed_at - interval '15 minutes';
  v_alert_stale := v_alert_last_success is null
    or v_alert_last_success < v_observed_at - interval '20 minutes';
  v_isolated_failure := (
    v_detector_recent_failures > 0
      and v_detector_last_success is not null
      and v_detector_last_success >= v_observed_at - interval '24 hours'
  ) or (
    v_alert_recent_failures > 0
      and v_alert_last_success is not null
      and v_alert_last_success >= v_observed_at - interval '24 hours'
  );
  v_has_temporary_backlog := v_retry_scheduled > 0;

  v_structural_critical := v_detector_job_count <> 1
    or v_detector_job_valid_count <> 1
    or v_alert_job_count <> 1
    or v_alert_job_valid_count <> 1
    or v_detector_stale
    or (v_alert_configured and v_alert_stale)
    or v_detector_recent_failures >= 2
    or v_alert_recent_failures >= 2
    or v_stale_claims > 0
    or v_terminal_failed > 0
    or v_pg_net_failures > 0;

  if v_structural_critical then
    v_system_health := 'critical';
  elsif not v_alert_configured then
    v_system_health := 'not_configured';
  elsif v_overdue_pending > 0
    or v_overdue_retries > 0
    or v_isolated_failure
    or v_has_temporary_backlog then
    v_system_health := 'degraded';
  else
    v_system_health := 'healthy';
  end if;

  if v_open_critical > 0 then
    v_incident_health := 'critical';
  elsif v_open_high > 0 then
    v_incident_health := 'high';
  elsif v_open_warning > 0 then
    v_incident_health := 'warning';
  else
    v_incident_health := 'clear';
  end if;

  return pg_catalog.jsonb_build_object(
    'observed_at', v_observed_at,
    'monitoring_system', pg_catalog.jsonb_build_object(
      'health', v_system_health,
      'alert_configuration', case when v_alert_configured then 'configured' else 'not_configured' end,
      'detector_stale', v_detector_stale,
      'alert_scheduler_stale', case when v_alert_configured then v_alert_stale else false end,
      'detector_job_count', v_detector_job_count,
      'detector_job_valid_count', v_detector_job_valid_count,
      'alert_job_count', v_alert_job_count,
      'alert_job_valid_count', v_alert_job_valid_count,
      'detector_last_success_at', v_detector_last_success,
      'alert_last_success_at', v_alert_last_success,
      'detector_recent_failure_count', v_detector_recent_failures,
      'alert_recent_failure_count', v_alert_recent_failures,
      'pg_net_failure_count_24h', v_pg_net_failures,
      'overdue_pending_count', v_overdue_pending,
      'overdue_retry_count', v_overdue_retries,
      'stale_claim_count', v_stale_claims,
      'terminal_failed_delivery_count', v_terminal_failed,
      'pending_count', v_pending,
      'retry_scheduled_count', v_retry_scheduled,
      'processing_count', v_processing,
      'sent_count_24h', v_sent_24h,
      'failed_count_24h', v_failed_24h,
      'suppressed_count_24h', v_suppressed_24h
    ),
    'payment_incidents', pg_catalog.jsonb_build_object(
      'health', v_incident_health,
      'open_count', v_open_incidents,
      'open_warning_count', v_open_warning,
      'open_high_count', v_open_high,
      'open_critical_count', v_open_critical,
      'oldest_open_at', v_oldest_open,
      'created_count_24h', v_incidents_created_24h,
      'resolved_count_24h', v_incidents_resolved_24h
    )
  );
end;
$$;

revoke all on function public.start_payment_monitoring_alert_invocation(uuid, timestamptz)
  from public, anon, authenticated;
revoke all on function public.mark_payment_monitoring_alert_invocation_succeeded(
  uuid, timestamptz, integer, integer, integer, integer, integer, integer, integer
) from public, anon, authenticated;
revoke all on function public.mark_payment_monitoring_alert_invocation_failed(
  uuid, timestamptz, text, integer
) from public, anon, authenticated;
revoke all on function public.invoke_payment_monitoring_alert_delivery()
  from public, anon, authenticated;
revoke all on function public.get_payment_monitoring_operational_health(timestamptz)
  from public, anon, authenticated;
revoke all on public.payment_monitoring_incident_operations from public, anon, authenticated;
revoke all on public.payment_monitoring_alert_delivery_operations from public, anon, authenticated;

grant execute on function public.start_payment_monitoring_alert_invocation(uuid, timestamptz)
  to service_role, postgres;
grant execute on function public.mark_payment_monitoring_alert_invocation_succeeded(
  uuid, timestamptz, integer, integer, integer, integer, integer, integer, integer
) to service_role, postgres;
grant execute on function public.mark_payment_monitoring_alert_invocation_failed(
  uuid, timestamptz, text, integer
) to service_role, postgres;
grant execute on function public.invoke_payment_monitoring_alert_delivery()
  to service_role, postgres;
grant execute on function public.get_payment_monitoring_operational_health(timestamptz)
  to service_role, postgres;
grant select on public.payment_monitoring_incident_operations
  to service_role, postgres;
grant select on public.payment_monitoring_alert_delivery_operations
  to service_role, postgres;

do $$
begin
  -- Preserve the Phase 3 job identity and cadence exactly.
  perform cron.schedule(
    'payment-monitoring-alert-delivery',
    '2-59/5 * * * *',
    'select public.invoke_payment_monitoring_alert_delivery();'
  );
end;
$$;

notify pgrst, 'reload schema';
