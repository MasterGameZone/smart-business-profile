begin;

select no_plan();

select has_table(
  'public',
  'payment_monitoring_alert_invocations',
  'alert invocation audit table exists'
);
select has_column('public', 'payment_monitoring_alert_invocations', 'pg_net_request_id', 'pg_net request correlation is persisted');
select has_column('public', 'payment_monitoring_alert_invocations', 'diagnostic_code', 'invocation diagnostic code is sanitized');
select has_view('public', 'payment_monitoring_incident_operations', 'incident operations view exists');
select has_view('public', 'payment_monitoring_alert_delivery_operations', 'delivery operations view exists');

select ok(
  (select relrowsecurity from pg_class where oid = 'public.payment_monitoring_alert_invocations'::regclass),
  'invocation audit table has RLS enabled'
);
select is(
  (select count(*) from pg_policy where polrelid = 'public.payment_monitoring_alert_invocations'::regclass),
  0::bigint,
  'invocation audit table has no frontend policies'
);
select is(
  has_table_privilege('anon', 'public.payment_monitoring_alert_invocations', 'select'),
  false,
  'anon cannot read invocation audit rows'
);
select is(
  has_table_privilege('authenticated', 'public.payment_monitoring_alert_invocations', 'select'),
  false,
  'authenticated cannot read invocation audit rows'
);
select ok(
  not has_table_privilege('public', 'public.payment_monitoring_alert_invocations', 'select'),
  'PUBLIC cannot read invocation audit rows'
);

select ok(
  'security_invoker=true' = any(coalesce((select reloptions from pg_class where oid = 'public.payment_monitoring_incident_operations'::regclass), array[]::text[])),
  'incident view uses security invoker'
);
select ok(
  'security_invoker=true' = any(coalesce((select reloptions from pg_class where oid = 'public.payment_monitoring_alert_delivery_operations'::regclass), array[]::text[])),
  'delivery view uses security invoker'
);
select is(
  has_table_privilege('anon', 'public.payment_monitoring_incident_operations', 'select'),
  false,
  'anon cannot read incident operations'
);
select is(
  has_table_privilege('authenticated', 'public.payment_monitoring_alert_delivery_operations', 'select'),
  false,
  'authenticated cannot read delivery operations'
);
select ok(
  not exists (
    select 1
    from pg_attribute
    where attrelid = 'public.payment_monitoring_incident_operations'::regclass
      and not attisdropped
      and attname ~* '(payload|body|signature|secret|email|phone|card|upi|credential|authorization)'
  ),
  'incident operations view exposes no sensitive payload or contact columns'
);
select ok(
  not exists (
    select 1
    from pg_attribute
    where attrelid = 'public.payment_monitoring_alert_delivery_operations'::regclass
      and not attisdropped
      and attname ~* '(payload|body|signature|secret|email|phone|card|upi|credential|authorization|provider_message_id)'
  ),
  'delivery operations view exposes no sensitive provider or contact columns'
);

select ok(
  (select p.prosecdef from pg_proc as p where p.oid = 'public.get_payment_monitoring_operational_health(timestamptz)'::regprocedure),
  'health RPC is security definer'
);
select ok(
  (select 'search_path=""' = any(p.proconfig) from pg_proc as p where p.oid = 'public.get_payment_monitoring_operational_health(timestamptz)'::regprocedure),
  'health RPC has an empty search path'
);
select is(
  has_function_privilege('anon', 'public.get_payment_monitoring_operational_health(timestamptz)', 'execute'),
  false,
  'anon cannot execute health RPC'
);
select is(
  has_function_privilege('authenticated', 'public.start_payment_monitoring_alert_invocation(uuid,timestamptz)', 'execute'),
  false,
  'authenticated cannot mutate invocation audit'
);
select ok(
  has_function_privilege('service_role', 'public.get_payment_monitoring_operational_health(timestamptz)', 'execute')
    and has_function_privilege('service_role', 'public.start_payment_monitoring_alert_invocation(uuid,timestamptz)', 'execute')
    and has_function_privilege('service_role', 'public.mark_payment_monitoring_alert_invocation_succeeded(uuid,timestamptz,integer,integer,integer,integer,integer,integer,integer)', 'execute')
    and has_function_privilege('service_role', 'public.mark_payment_monitoring_alert_invocation_failed(uuid,timestamptz,text,integer)', 'execute'),
  'service_role can execute restricted operational RPCs'
);

insert into public.payment_monitoring_incidents (
  id, incident_key, incident_type, severity, status, source_table, source_record_id,
  provider_subscription_id, provider_event_id, diagnostic_code, first_detected_at,
  last_detected_at, detection_count, created_at, updated_at
)
values (
  '40000000-0000-4000-8000-000000000001', 'ops-incident-one', 'webhook_processing_failure', 'critical', 'open',
  'subscription_webhook_events', 'event_test_operations_001', 'sub_test_operations_001',
  'event_test_operations_001', 'webhook_processing_failed', '2026-07-22T12:00:00Z',
  '2026-07-22T12:05:00Z', 2, '2026-07-22T12:00:00Z', '2026-07-22T12:05:00Z'
), (
  '40000000-0000-4000-8000-000000000002', 'ops-incident-two', 'subscription_grace_period', 'warning', 'open',
  'business_owner_subscriptions', 'sub_row_operations_002', null, null, 'subscription_grace_period_expired',
  '2026-07-22T12:10:00Z', '2026-07-22T12:10:00Z', 1, '2026-07-22T12:10:00Z', '2026-07-22T12:10:00Z'
);

insert into public.payment_monitoring_alert_deliveries (
  id, incident_id, alert_severity, delivery_key, status, available_at, sent_at, created_at, updated_at
)
values (
  '50000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000001', 'critical',
  'payment-monitoring-operations-old', 'pending', '2026-07-22T12:50:00Z', null, '2026-07-22T12:01:00Z', '2026-07-22T12:01:00Z'
), (
  '50000000-0000-4000-8000-000000000002', '40000000-0000-4000-8000-000000000001', 'critical',
  'payment-monitoring-operations-new', 'sent', '2026-07-22T12:02:00Z', '2026-07-22T12:03:00Z', '2026-07-22T12:02:00Z', '2026-07-22T12:03:00Z'
);

select is(
  (select count(*) from public.payment_monitoring_incident_operations),
  2::bigint,
  'incident operations view returns one row per incident'
);
select is(
  (select latest_delivery_id from public.payment_monitoring_incident_operations where incident_id = '40000000-0000-4000-8000-000000000001'),
  '50000000-0000-4000-8000-000000000002'::uuid,
  'incident view deterministically selects the latest delivery'
);
select is(
  (select count(*) from public.payment_monitoring_alert_delivery_operations),
  2::bigint,
  'delivery operations view exposes each sanitized delivery row'
);

select is(
  (public.invoke_payment_monitoring_alert_delivery()->>'status'),
  'not_configured',
  'missing Vault configuration is audited without a request'
);
select is(
  (select status from public.payment_monitoring_alert_invocations order by invoked_at desc, id desc limit 1),
  'not_configured',
  'not-configured invocation is retained'
);
select is(
  (public.invoke_payment_monitoring_alert_delivery()->>'diagnostic_code'),
  null,
  'not-configured wrapper response contains no diagnostic detail'
);

insert into cron.job_run_details (jobid, runid, command, status, start_time, end_time)
select jobid, 9000000 + row_number() over (order by jobname), command, 'succeeded', '2026-07-22T12:55:00Z', '2026-07-22T12:55:01Z'
from cron.job
where jobname in ('payment-monitoring-detection', 'payment-monitoring-alert-delivery');

select is(
  public.get_payment_monitoring_operational_health('2026-07-22T13:00:00Z')->'monitoring_system'->>'health',
  'not_configured',
  'missing alert Vault configuration is reported as not_configured when jobs are healthy'
);

select vault.create_secret(
  'http://127.0.0.1:1/fake-payment-monitoring-alert',
  'payment_monitoring_alert_function_url',
  'deterministic fake test URL',
  null
);
select vault.create_secret(
  'fake-cron-secret-for-pgtap-only-000000000000000000000000000000',
  'payment_monitoring_alert_cron_secret',
  'deterministic fake test secret',
  null
);

select is(
  public.get_payment_monitoring_operational_health('2026-07-22T13:00:00Z')->'monitoring_system'->>'health',
  'healthy',
  'configured system with recent successful jobs and no backlog is healthy'
);

update public.payment_monitoring_alert_deliveries
set available_at = '2026-07-22T12:00:00Z'
where id = '50000000-0000-4000-8000-000000000001';
select is(
  public.get_payment_monitoring_operational_health('2026-07-22T13:00:00Z')->'monitoring_system'->>'health',
  'degraded',
  'overdue pending delivery makes monitoring-system health degraded'
);
create temporary table operations_invocations on commit drop as
select (public.invoke_payment_monitoring_alert_delivery()->>'invocation_id')::uuid as invocation_id;
select is((select count(*) from operations_invocations), 1::bigint, 'configured wrapper returns an invocation identifier');
select ok(
  (public.invoke_payment_monitoring_alert_delivery()->>'request_id')::bigint is not null,
  'configured wrapper persists and returns a pg_net request identifier'
);
select ok(
  not exists (
    select 1
    from public.payment_monitoring_alert_invocations
    where diagnostic_code like '%secret%'
  ),
  'invocation audit never stores secret material'
);

select public.start_payment_monitoring_alert_invocation(
  (select invocation_id from operations_invocations),
  '2026-07-22T12:30:00Z'
);
select ok(
  public.mark_payment_monitoring_alert_invocation_succeeded(
    (select invocation_id from operations_invocations),
    '2026-07-22T12:31:00Z', 200, 2, 2, 1, 1, 0, 1
  ),
  'successful Edge processing is recorded against the invocation'
);
select is(
  (select status from public.payment_monitoring_alert_invocations where id = (select invocation_id from operations_invocations)),
  'succeeded',
  'successful invocation reaches succeeded'
);

create temporary table failed_invocation on commit drop as
select (public.invoke_payment_monitoring_alert_delivery()->>'invocation_id')::uuid as invocation_id;
select public.start_payment_monitoring_alert_invocation((select invocation_id from failed_invocation), '2026-07-22T12:32:00Z');
select ok(
  public.mark_payment_monitoring_alert_invocation_failed(
    (select invocation_id from failed_invocation),
    '2026-07-22T12:33:00Z', 'alert_delivery_failed', 500
  ),
  'failed Edge processing is recorded with a safe diagnostic code'
);
select is(
  (select diagnostic_code from public.payment_monitoring_alert_invocations where id = (select invocation_id from failed_invocation)),
  'alert_delivery_failed',
  'failed invocation stores only a safe diagnostic code'
);
select is(
  public.start_payment_monitoring_alert_invocation('40000000-0000-4000-8000-000000000099', '2026-07-22T12:34:00Z'),
  false,
  'unknown invocation ID is rejected without an audit row'
);

select is(
  public.get_payment_monitoring_operational_health('2026-07-22T13:00:00Z')->'payment_incidents'->>'health',
  'critical',
  'payment incident health reflects the open critical incident independently'
);

update public.payment_monitoring_alert_deliveries
set status = 'processing',
  claim_token = '60000000-0000-4000-8000-000000000001',
  claim_started_at = '2026-07-22T12:00:00Z',
  claim_expires_at = '2026-07-22T12:10:00Z',
  sent_at = null
where id = '50000000-0000-4000-8000-000000000001';
select is(
  public.get_payment_monitoring_operational_health('2026-07-22T13:00:00Z')->'monitoring_system'->>'health',
  'critical',
  'expired processing claims make monitoring-system health critical'
);
select is(
  (public.get_payment_monitoring_operational_health('2026-07-22T13:00:00Z')->'monitoring_system'->>'stale_claim_count')::integer,
  1,
  'health reports expired processing claims'
);

select ok(
  not exists (
    select 1
    from public.payment_monitoring_alert_invocations
    where pg_net_request_id is null
      and status = 'succeeded'
  ),
  'completed configured invocations retain their request correlation'
);
select ok(
  not exists (
    select 1
    from public.payment_monitoring_alert_invocations
    where diagnostic_code ~* '(secret|email|phone|card|upi|payload|signature|credential)'
  ),
  'invocation diagnostics contain no sensitive data'
);

select is(
  (select count(*) from cron.job where jobname = 'payment-monitoring-alert-delivery'),
  1::bigint,
  'Phase 3 alert Cron job remains unique'
);
select is(
  (select schedule from cron.job where jobname = 'payment-monitoring-alert-delivery'),
  '2-59/5 * * * *',
  'Phase 3 alert Cron schedule remains unchanged'
);
select is(
  (select command from cron.job where jobname = 'payment-monitoring-alert-delivery'),
  'select public.invoke_payment_monitoring_alert_delivery();',
  'Phase 3 alert Cron command remains unchanged'
);

select * from finish();
rollback;
