begin;

select no_plan();

select has_table(
  'public',
  'payment_monitoring_alert_deliveries',
  'alert delivery outbox exists'
);

select has_column('public', 'payment_monitoring_alert_deliveries', 'incident_id', 'delivery references an incident');
select has_column('public', 'payment_monitoring_alert_deliveries', 'delivery_key', 'delivery key exists');
select has_column('public', 'payment_monitoring_alert_deliveries', 'claim_token', 'claim token exists');
select has_column('public', 'payment_monitoring_alert_deliveries', 'claim_expires_at', 'claim lease exists');
select has_column('public', 'payment_monitoring_alert_deliveries', 'provider_message_id', 'provider message ID exists');
select has_column('public', 'payment_monitoring_alert_deliveries', 'last_error_code', 'sanitized error code exists');

select ok(
  (select relrowsecurity from pg_class where oid = 'public.payment_monitoring_alert_deliveries'::regclass),
  'alert delivery RLS is enabled'
);
select is(
  (select count(*) from pg_policy where polrelid = 'public.payment_monitoring_alert_deliveries'::regclass),
  0::bigint,
  'alert delivery has no frontend policies'
);
select is(
  has_table_privilege('anon', 'public.payment_monitoring_alert_deliveries', 'select'),
  false,
  'anon cannot read alert deliveries'
);
select is(
  has_table_privilege('authenticated', 'public.payment_monitoring_alert_deliveries', 'select'),
  false,
  'authenticated cannot read alert deliveries'
);
select ok(
  not exists (
    select 1
    from pg_class as relation
    cross join lateral aclexplode(coalesce(relation.relacl, acldefault('r', relation.relowner))) as privilege
    where relation.oid = 'public.payment_monitoring_alert_deliveries'::regclass
      and privilege.grantee = 0
      and privilege.privilege_type <> 'USAGE'
  ),
  'PUBLIC has no alert delivery table privilege'
);
select ok(
  to_regclass('public.payment_monitoring_alert_deliveries_delivery_key_uidx') is not null
    and to_regclass('public.payment_monitoring_alert_deliveries_due_idx') is not null
    and to_regclass('public.payment_monitoring_alert_deliveries_processing_lease_idx') is not null
    and to_regclass('public.payment_monitoring_alert_deliveries_incident_id_idx') is not null
    and to_regclass('public.payment_monitoring_alert_deliveries_status_created_idx') is not null
    and to_regclass('public.payment_monitoring_alert_deliveries_sent_at_idx') is not null
    and to_regclass('public.payment_monitoring_alert_deliveries_failed_at_idx') is not null,
  'operational alert-delivery indexes exist'
);
select ok(
  exists (
    select 1
    from pg_constraint
    where conname = 'payment_monitoring_alert_deliveries_incident_id_fkey'
      and conrelid = 'public.payment_monitoring_alert_deliveries'::regclass
      and confdeltype = 'a'
  ),
  'delivery history uses non-cascading incident foreign key'
);
select is(
  pg_get_function_result('public.claim_payment_monitoring_alert_deliveries(integer,timestamptz,integer)'::regprocedure),
  'TABLE(delivery_id uuid, claim_token uuid, delivery_key text, incident_id uuid, incident_type text, alert_severity text, diagnostic_code text, source_table text, source_record_id text, first_detected_at timestamp with time zone, last_detected_at timestamp with time zone, detection_count integer, provider_subscription_id text, provider_event_id text)',
  'claim RPC returns only sanitized delivery and incident fields'
);

select is(
  has_function_privilege('anon', 'public.enqueue_payment_monitoring_alert_deliveries(timestamptz)', 'execute'),
  false,
  'anon cannot execute enqueue RPC'
);
select is(
  has_function_privilege('authenticated', 'public.claim_payment_monitoring_alert_deliveries(integer,timestamptz,integer)', 'execute'),
  false,
  'authenticated cannot execute claim RPC'
);
select ok(
  has_function_privilege('service_role', 'public.enqueue_payment_monitoring_alert_deliveries(timestamptz)', 'execute')
    and has_function_privilege('service_role', 'public.claim_payment_monitoring_alert_deliveries(integer,timestamptz,integer)', 'execute')
    and has_function_privilege('service_role', 'public.mark_payment_monitoring_alert_delivery_sent(uuid,uuid,timestamptz,text)', 'execute')
    and has_function_privilege('service_role', 'public.mark_payment_monitoring_alert_delivery_failed(uuid,uuid,timestamptz,text,boolean)', 'execute'),
  'service_role can execute alert-delivery RPCs'
);
select ok(
  has_function_privilege('postgres', 'public.enqueue_payment_monitoring_alert_deliveries(timestamptz)', 'execute')
    and has_function_privilege('postgres', 'public.claim_payment_monitoring_alert_deliveries(integer,timestamptz,integer)', 'execute')
    and has_function_privilege('postgres', 'public.invoke_payment_monitoring_alert_delivery()', 'execute'),
  'database owner can execute internal alert operations'
);
select is(
  has_function_privilege('authenticated', 'public.invoke_payment_monitoring_alert_delivery()', 'execute'),
  false,
  'authenticated cannot invoke alert delivery'
);
select ok(
  has_function_privilege('service_role', 'public.detect_payment_monitoring_incidents(timestamptz)', 'execute')
    and has_function_privilege('service_role', 'public.run_payment_monitoring_cycle(timestamptz)', 'execute'),
  'Phase 1 and Phase 2 execution privileges remain intact'
);

insert into public.payment_monitoring_incidents (
  id, incident_key, incident_type, severity, status, source_table, source_record_id,
  diagnostic_code, first_detected_at, last_detected_at, detection_count, resolved_at, created_at, updated_at
)
values
(
  '10000000-0000-4000-8000-000000000001', 'alert-warning', 'webhook_processing_failure', 'warning', 'open',
  'subscription_webhook_events', 'event_test_warning', 'webhook_processing_failed',
  '2026-07-22T12:00:00Z', '2026-07-22T12:00:00Z', 1, null, '2026-07-22T12:00:00Z', '2026-07-22T12:00:00Z'
),
(
  '10000000-0000-4000-8000-000000000002', 'alert-high', 'webhook_processing_failure', 'high', 'open',
  'subscription_webhook_events', 'event_test_high', 'webhook_processing_failed',
  '2026-07-22T12:00:00Z', '2026-07-22T12:00:00Z', 1, null, '2026-07-22T12:00:00Z', '2026-07-22T12:00:00Z'
),
(
  '10000000-0000-4000-8000-000000000003', 'alert-critical', 'provider_subscription_not_activated', 'critical', 'open',
  'business_owner_subscriptions', 'sub_row_test_critical', 'provider_subscription_not_activated',
  '2026-07-22T12:00:00Z', '2026-07-22T12:00:00Z', 1, null, '2026-07-22T12:00:00Z', '2026-07-22T12:00:00Z'
),
(
  '10000000-0000-4000-8000-000000000004', 'alert-resolved', 'webhook_processing_failure', 'high', 'resolved',
  'subscription_webhook_events', 'event_test_resolved', 'webhook_processing_failed',
  '2026-07-22T12:00:00Z', '2026-07-22T12:00:00Z', 1, '2026-07-22T12:01:00Z', '2026-07-22T12:00:00Z', '2026-07-22T12:00:00Z'
);

select is(
  (public.enqueue_payment_monitoring_alert_deliveries('2026-07-22T12:02:00Z')->>'enqueued')::integer,
  2,
  'only open high and critical incidents are enqueued'
);
select is(
  (public.enqueue_payment_monitoring_alert_deliveries('2026-07-22T12:03:00Z')->>'enqueued')::integer,
  0,
  'repeated enqueue is duplicate-safe'
);
select is(
  (select count(*) from public.payment_monitoring_alert_deliveries where incident_id = '10000000-0000-4000-8000-000000000001'),
  0::bigint,
  'warning incidents do not create email deliveries'
);
select is(
  (select count(*) from public.payment_monitoring_alert_deliveries where incident_id = '10000000-0000-4000-8000-000000000004'),
  0::bigint,
  'resolved incidents do not create email deliveries'
);
select is(
  (select count(*) from public.payment_monitoring_alert_deliveries where incident_id = '10000000-0000-4000-8000-000000000003' and alert_severity = 'critical'),
  1::bigint,
  'an initially critical incident receives only a critical delivery'
);

update public.payment_monitoring_incidents
set severity = 'critical', last_detected_at = '2026-07-22T12:04:00Z', detection_count = 2
where id = '10000000-0000-4000-8000-000000000002';
select is(
  (public.enqueue_payment_monitoring_alert_deliveries('2026-07-22T12:05:00Z')->>'enqueued')::integer,
  1,
  'high-to-critical escalation creates one additional delivery'
);
select is(
  (select count(*) from public.payment_monitoring_alert_deliveries where incident_id = '10000000-0000-4000-8000-000000000002'),
  2::bigint,
  'same incident has exactly one delivery per observed severity'
);

insert into public.payment_monitoring_incidents (
  id, incident_key, incident_type, severity, status, source_table, source_record_id,
  diagnostic_code, first_detected_at, last_detected_at, detection_count, created_at, updated_at
)
values (
  '10000000-0000-4000-8000-000000000005', 'alert-resolved-recur', 'subscription_grace_period', 'critical', 'open',
  'business_owner_subscriptions', 'sub_row_test_recur', 'subscription_grace_period_expired',
  '2026-07-22T12:00:00Z', '2026-07-22T12:00:00Z', 1, '2026-07-22T12:00:00Z', '2026-07-22T12:00:00Z'
);
select is(
  (public.enqueue_payment_monitoring_alert_deliveries('2026-07-22T12:06:00Z')->>'enqueued')::integer,
  1,
  'a new incident row can create a new delivery'
);

create temporary table alert_incident_snapshot on commit drop as
select id, severity, status, detection_count, last_detected_at
from public.payment_monitoring_incidents;

create temporary table claimed_first on commit drop as
select *
from public.claim_payment_monitoring_alert_deliveries(2, '2026-07-22T12:10:00Z', 300);
select is((select count(*) from claimed_first), 2::bigint, 'claim respects the maximum batch size');
select is(
  (select count(*) from public.payment_monitoring_alert_deliveries where status = 'processing'),
  2::bigint,
  'due deliveries transition atomically to processing'
);
select is(
  (select min(attempt_count) from public.payment_monitoring_alert_deliveries where status = 'processing'),
  1,
  'claim increments attempt count exactly once'
);
select ok(
  (select bool_and(claim_token is not null and claim_started_at = '2026-07-22T12:10:00Z' and claim_expires_at = '2026-07-22T12:15:00Z')
   from public.payment_monitoring_alert_deliveries where status = 'processing'),
  'claim sets a bounded lease on each delivery'
);
create temporary table claimed_remaining on commit drop as
select * from public.claim_payment_monitoring_alert_deliveries(10, '2026-07-22T12:11:00Z', 300);
select is((select count(*) from claimed_remaining), 2::bigint, 'remaining due deliveries can be claimed');
select is(
  (select count(*) from public.claim_payment_monitoring_alert_deliveries(10, '2026-07-22T12:11:00Z', 300)),
  0::bigint,
  'active claims cannot be stolen before expiry'
);
select ok(
  public.mark_payment_monitoring_alert_delivery_sent(
    (select delivery_id from claimed_remaining order by delivery_key limit 1),
    (select claim_token from claimed_remaining order by delivery_key limit 1),
    '2026-07-22T12:11:30Z',
    'provider_message_remaining_001'
  ),
  'one remaining delivery completes'
);
select ok(
  public.mark_payment_monitoring_alert_delivery_sent(
    (select delivery_id from claimed_remaining order by delivery_key desc limit 1),
    (select claim_token from claimed_remaining order by delivery_key desc limit 1),
    '2026-07-22T12:11:31Z',
    'provider_message_remaining_002'
  ),
  'the other remaining delivery completes'
);

select ok(
  public.mark_payment_monitoring_alert_delivery_sent(
    (select delivery_id from claimed_first order by delivery_key limit 1),
    (select claim_token from claimed_first order by delivery_key limit 1),
    '2026-07-22T12:12:00Z',
    'provider_message_test_001'
  ),
  'matching claim can be marked sent'
);
select ok(
  public.mark_payment_monitoring_alert_delivery_sent(
    (select delivery_id from claimed_first order by delivery_key limit 1),
    (select claim_token from claimed_first order by delivery_key limit 1),
    '2026-07-22T12:13:00Z',
    'provider_message_test_001'
  ),
  'repeating the same successful completion is idempotent'
);
select throws_ok(
  format(
    'select public.mark_payment_monitoring_alert_delivery_sent(%L, %L, %L, %L)',
    (select delivery_id from claimed_first order by delivery_key limit 1),
    '20000000-0000-4000-8000-000000000099',
    '2026-07-22T12:13:30Z',
    'provider_message_test_001'
  ),
  '23514',
  null,
  'mismatched repeated success claim is rejected'
);
select is(
  (select status from public.payment_monitoring_alert_deliveries where provider_message_id = 'provider_message_test_001'),
  'sent',
  'sent transition stores only the provider message ID'
);
select ok(
  (select claim_token is null and claim_started_at is null and claim_expires_at is null and sent_at is not null
   from public.payment_monitoring_alert_deliveries where provider_message_id = 'provider_message_test_001'),
  'sent transition clears claim lease fields'
);

select throws_ok(
  format(
    'select public.mark_payment_monitoring_alert_delivery_sent(%L, %L, %L, %L)',
    (select delivery_id from claimed_first order by delivery_key desc limit 1),
    '20000000-0000-4000-8000-000000000099',
    '2026-07-22T12:14:00Z',
    'provider_message_test_002'
  ),
  '42501',
  null,
  'mismatched completion claim is rejected'
);

select ok(
  public.mark_payment_monitoring_alert_delivery_failed(
    (select delivery_id from claimed_first order by delivery_key desc limit 1),
    (select claim_token from claimed_first order by delivery_key desc limit 1),
    '2026-07-22T12:14:00Z',
    'email_rate_limited',
    true
  ),
  'retryable failure is recorded'
);
select ok(
  (select status = 'retry_scheduled' and available_at = '2026-07-22T12:19:00Z' and last_error_code = 'email_rate_limited'
    and claim_token is null and failed_at is null
   from public.payment_monitoring_alert_deliveries where last_error_code = 'email_rate_limited'),
  'retryable failure uses the five-minute bounded backoff'
);
select ok(
  public.mark_payment_monitoring_alert_delivery_failed(
    (select delivery_id from claimed_first order by delivery_key desc limit 1),
    (select claim_token from claimed_first order by delivery_key desc limit 1),
    '2026-07-22T12:15:00Z',
    'email_rate_limited',
    true
  ),
  'matching retry result is idempotent'
);
select is(
  (select count(*) from public.claim_payment_monitoring_alert_deliveries(10, '2026-07-22T12:18:00Z', 300)),
  0::bigint,
  'future retry deliveries are not claimed early'
);
create temporary table claimed_retry on commit drop as
select * from public.claim_payment_monitoring_alert_deliveries(10, '2026-07-22T12:19:00Z', 300);
select is((select count(*) from claimed_retry), 1::bigint, 'retry becomes claimable at its scheduled time');
select ok(
  public.mark_payment_monitoring_alert_delivery_sent(
    (select delivery_id from claimed_retry limit 1),
    (select claim_token from claimed_retry limit 1),
    '2026-07-22T12:19:30Z',
    'provider_message_test_003'
  ),
  'a retried delivery can complete successfully'
);

insert into public.payment_monitoring_incidents (
  id, incident_key, incident_type, severity, status, source_table, source_record_id,
  diagnostic_code, first_detected_at, last_detected_at, detection_count, created_at, updated_at
)
values (
  '10000000-0000-4000-8000-000000000006', 'alert-max-attempts', 'webhook_processing_failure', 'high', 'open',
  'subscription_webhook_events', 'event_test_max_attempts', 'webhook_processing_failed',
  '2026-07-22T12:00:00Z', '2026-07-22T12:00:00Z', 1, '2026-07-22T12:00:00Z', '2026-07-22T12:00:00Z'
);
insert into public.payment_monitoring_alert_deliveries (
  incident_id, alert_severity, delivery_key, status, attempt_count, max_attempts, available_at
)
values (
  '10000000-0000-4000-8000-000000000006', 'high', 'payment-monitoring-email:max-attempts:high',
  'pending', 0, 1, '2026-07-22T12:20:00Z'
);
create temporary table claimed_max on commit drop as
select * from public.claim_payment_monitoring_alert_deliveries(10, '2026-07-22T12:20:00Z', 300);
select ok(
  public.mark_payment_monitoring_alert_delivery_failed(
    (select delivery_id from claimed_max),
    (select claim_token from claimed_max),
    '2026-07-22T12:20:00Z',
    'email_invalid_recipient',
    true
  ),
  'maximum attempts become terminal even for a retryable provider result'
);
select is(
  (select status from public.payment_monitoring_alert_deliveries where delivery_key = 'payment-monitoring-email:max-attempts:high'),
  'failed',
  'terminal failure is persisted as failed'
);

insert into public.payment_monitoring_incidents (
  id, incident_key, incident_type, severity, status, source_table, source_record_id,
  diagnostic_code, first_detected_at, last_detected_at, detection_count, created_at, updated_at
)
values (
  '10000000-0000-4000-8000-000000000007', 'alert-expired-claim', 'subscription_grace_period', 'critical', 'open',
  'business_owner_subscriptions', 'sub_row_test_expired', 'subscription_grace_period_expired',
  '2026-07-22T12:00:00Z', '2026-07-22T12:00:00Z', 1, '2026-07-22T12:00:00Z', '2026-07-22T12:00:00Z'
);
select public.enqueue_payment_monitoring_alert_deliveries('2026-07-22T12:20:00Z');
create temporary table claimed_expired on commit drop as
select * from public.claim_payment_monitoring_alert_deliveries(10, '2026-07-22T12:20:00Z', 300);
select is(
  (select count(*) from public.claim_payment_monitoring_alert_deliveries(10, '2026-07-22T12:24:00Z', 300)),
  0::bigint,
  'unexpired processing claim is not stolen'
);
create temporary table claimed_recovered on commit drop as
select * from public.claim_payment_monitoring_alert_deliveries(10, '2026-07-22T12:26:00Z', 300);
select is(
  (select count(*) from claimed_recovered where incident_id = '10000000-0000-4000-8000-000000000007'),
  1::bigint,
  'expired processing claim is recovered and re-claimed'
);
select is(
  (select attempt_count from public.payment_monitoring_alert_deliveries where incident_id = '10000000-0000-4000-8000-000000000007'),
  2,
  'recovered claim increments the attempt count once more'
);

insert into public.payment_monitoring_incidents (
  id, incident_key, incident_type, severity, status, source_table, source_record_id,
  diagnostic_code, first_detected_at, last_detected_at, detection_count, created_at, updated_at
)
values (
  '10000000-0000-4000-8000-000000000008', 'alert-suppression', 'webhook_processing_failure', 'high', 'open',
  'subscription_webhook_events', 'event_test_suppression', 'webhook_processing_failed',
  '2026-07-22T12:00:00Z', '2026-07-22T12:00:00Z', 1, '2026-07-22T12:00:00Z', '2026-07-22T12:00:00Z'
);
select public.enqueue_payment_monitoring_alert_deliveries('2026-07-22T12:27:00Z');
update public.payment_monitoring_incidents
set status = 'resolved', resolved_at = '2026-07-22T12:28:00Z'
where id = '10000000-0000-4000-8000-000000000008';
select is(
  (select count(*) from public.claim_payment_monitoring_alert_deliveries(10, '2026-07-22T12:29:00Z', 300)),
  0::bigint,
  'resolved incident delivery is suppressed before send'
);
select is(
  (select status from public.payment_monitoring_alert_deliveries where incident_id = '10000000-0000-4000-8000-000000000008'),
  'suppressed',
  'suppressed delivery is terminal and retained'
);

select is(
  (select count(*) from alert_incident_snapshot as before_row join public.payment_monitoring_incidents as after_row using (id)
   where before_row.severity is not distinct from after_row.severity
     and before_row.status is not distinct from after_row.status
     and before_row.detection_count is not distinct from after_row.detection_count
     and before_row.last_detected_at is not distinct from after_row.last_detected_at),
  (select count(*) from alert_incident_snapshot),
  'delivery operations do not modify incident rows'
);
select is(
  (select count(*) from public.payment_monitoring_alert_deliveries where last_error_code like '%raw%'),
  0::bigint,
  'raw provider errors are not stored'
);

select ok(exists (select 1 from pg_extension where extname = 'pg_net'), 'pg_net is available');
select ok(
  (select p.prosecdef from pg_proc as p where p.oid = 'public.invoke_payment_monitoring_alert_delivery()'::regprocedure),
  'Vault invocation wrapper is security definer'
);
select ok(
  (select 'search_path=""' = any(p.proconfig) from pg_proc as p where p.oid = 'public.invoke_payment_monitoring_alert_delivery()'::regprocedure),
  'Vault invocation wrapper has an empty search path'
);
select is(
  (public.invoke_payment_monitoring_alert_delivery()->>'status'),
  'not_configured',
  'missing Vault configuration fails safely'
);
select is(
  has_function_privilege('anon', 'public.invoke_payment_monitoring_alert_delivery()', 'execute'),
  false,
  'anon cannot invoke the Vault wrapper'
);
select is(
  (select count(*) from cron.job where jobname = 'payment-monitoring-alert-delivery'),
  1::bigint,
  'exactly one alert-delivery Cron job exists'
);
select is(
  (select schedule from cron.job where jobname = 'payment-monitoring-alert-delivery'),
  '2-59/5 * * * *',
  'alert delivery runs two minutes after the detector cadence'
);
select is(
  (select command from cron.job where jobname = 'payment-monitoring-alert-delivery'),
  'select public.invoke_payment_monitoring_alert_delivery();',
  'alert Cron invokes only the schema-qualified wrapper'
);
select ok(
  (select active from cron.job where jobname = 'payment-monitoring-alert-delivery')
    and (select command !~* '(https?://|email|secret|api[_-]?key|authorization|token)' from cron.job where jobname = 'payment-monitoring-alert-delivery'),
  'alert Cron is active and contains no endpoint or secret'
);
select is(
  (select count(*) from cron.job where jobname = 'payment-monitoring-detection'),
  1::bigint,
  'Phase 2 detector Cron job remains present'
);
select is(
  (select schedule from cron.job where jobname = 'payment-monitoring-detection'),
  '*/5 * * * *',
  'Phase 2 detector schedule remains unchanged'
);
select is(
  (select command from cron.job where jobname = 'payment-monitoring-detection'),
  'select public.run_payment_monitoring_cycle();',
  'Phase 2 detector command remains unchanged'
);

select * from finish();
rollback;
