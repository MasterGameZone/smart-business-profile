begin;

select no_plan();

select has_table(
  'public',
  'payment_monitoring_incidents',
  'payment monitoring incident table exists'
);
select is(
  (
    select count(*)
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'payment_monitoring_incidents'
  ),
  18::bigint,
  'incident table has the required columns'
);
select is(
  (
    select count(*)
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'payment_monitoring_incidents'
      and is_nullable = 'NO'
  ),
  12::bigint,
  'required incident columns are not nullable'
);
select is(
  (
    select count(*)
    from pg_constraint
    where conrelid = 'public.payment_monitoring_incidents'::regclass
      and contype = 'c'
  ),
  10::bigint,
  'incident validation constraints exist'
);
select ok(
  to_regclass('public.payment_monitoring_incidents_open_key_idx') is not null,
  'open incident key is uniquely indexed'
);
select ok(
  to_regclass('public.payment_monitoring_incidents_open_severity_first_detected_idx') is not null,
  'open severity and first detection are indexed'
);
select ok(
  to_regclass('public.payment_monitoring_incidents_type_status_idx') is not null
    and to_regclass('public.payment_monitoring_incidents_owner_id_idx') is not null
    and to_regclass('public.payment_monitoring_incidents_provider_subscription_id_idx') is not null
    and to_regclass('public.payment_monitoring_incidents_provider_event_id_idx') is not null
    and to_regclass('public.payment_monitoring_incidents_last_detected_at_idx') is not null,
  'incident lookup indexes exist'
);
select ok(
  (
    select relrowsecurity
    from pg_class
    where oid = 'public.payment_monitoring_incidents'::regclass
  ),
  'RLS is enabled for incidents'
);
select is(
  has_table_privilege('anon', 'public.payment_monitoring_incidents', 'select'),
  false,
  'anon cannot read incident rows'
);
select is(
  has_table_privilege('authenticated', 'public.payment_monitoring_incidents', 'select'),
  false,
  'authenticated cannot read incident rows'
);
select is(
  has_table_privilege('anon', 'public.payment_monitoring_incidents', 'insert'),
  false,
  'anon cannot insert incident rows'
);
select is(
  has_table_privilege('authenticated', 'public.payment_monitoring_incidents', 'update'),
  false,
  'authenticated cannot modify incident rows'
);
select is(
  has_function_privilege('anon', 'public.detect_payment_monitoring_incidents(timestamptz)', 'execute'),
  false,
  'anon cannot execute the detector'
);
select is(
  has_function_privilege('authenticated', 'public.detect_payment_monitoring_incidents(timestamptz)', 'execute'),
  false,
  'authenticated cannot execute the detector'
);
select is(
  has_function_privilege('anon', 'public.resolve_payment_monitoring_incident(uuid,text)', 'execute'),
  false,
  'anon cannot execute incident resolution'
);

insert into auth.users (id, aud, role, email, created_at, updated_at)
values
(
  '22222222-2222-4222-8222-222222222222',
  'authenticated',
  'authenticated',
  'monitoring-owner@example.test',
  now(),
  now()
),
(
  '33333333-3333-4333-8333-333333333333',
  'authenticated',
  'authenticated',
  'monitoring-incomplete@example.test',
  now(),
  now()
),
(
  '44444444-4444-4444-8444-444444444444',
  'authenticated',
  'authenticated',
  'monitoring-provider@example.test',
  now(),
  now()
),
(
  '88888888-8888-4888-8888-888888888888',
  'authenticated',
  'authenticated',
  'monitoring-grace@example.test',
  now(),
  now()
);

insert into public.business_owner_subscriptions (
  id,
  owner_id,
  plan_id,
  billing_provider,
  provider_subscription_id,
  provider_plan_id,
  status,
  creation_attempt_id,
  creation_started_at,
  grace_period_end,
  created_at,
  updated_at
)
values
(
  '55555555-5555-4555-8555-555555555551',
  '22222222-2222-4222-8222-222222222222',
  'pro_analytics',
  'razorpay',
  null,
  null,
  'incomplete',
  '66666666-6666-4666-8666-666666666651',
  '2026-07-22T11:50:00Z',
  null,
  '2026-07-22T11:50:00Z',
  '2026-07-22T11:50:00Z'
),
(
  '55555555-5555-4555-8555-555555555552',
  '33333333-3333-4333-8333-333333333333',
  'pro_analytics',
  'razorpay',
  null,
  null,
  'incomplete',
  null,
  null,
  null,
  '2026-07-22T11:20:00Z',
  '2026-07-22T11:20:00Z'
),
(
  '55555555-5555-4555-8555-555555555553',
  '44444444-4444-4444-8444-444444444444',
  'pro_analytics',
  'razorpay',
  'sub_test_example',
  'plan_test_example',
  'incomplete',
  null,
  null,
  null,
  '2026-07-22T11:20:00Z',
  '2026-07-22T11:20:00Z'
),
(
  '55555555-5555-4555-8555-555555555554',
  '88888888-8888-4888-8888-888888888888',
  'pro_analytics',
  'razorpay',
  'sub_test_grace',
  'plan_test_example',
  'past_due',
  null,
  null,
  '2026-07-22T11:59:00Z',
  '2026-07-22T11:00:00Z',
  '2026-07-22T11:00:00Z'
);

insert into public.subscription_webhook_events (
  id,
  billing_provider,
  provider_event_id,
  event_type,
  subscription_id,
  owner_id,
  provider_subscription_id,
  processing_status,
  processing_attempts,
  payload,
  last_error,
  received_at,
  processed_at,
  created_at,
  updated_at
)
values
(
  '77777777-7777-4777-8777-777777777751',
  'razorpay',
  'event_test_correlation',
  'subscription.activated',
  null,
  null,
  'sub_test_missing',
  'failed',
  1,
  '{"source":"phase1_fake"}'::jsonb,
  'Sensitive raw provider error must never be copied',
  '2026-07-22T11:00:00Z',
  '2026-07-22T11:01:00Z',
  '2026-07-22T11:00:00Z',
  '2026-07-22T11:01:00Z'
),
(
  '77777777-7777-4777-8777-777777777752',
  'razorpay',
  'event_test_failed',
  'subscription.updated',
  '55555555-5555-4555-8555-555555555553',
  '22222222-2222-4222-8222-222222222222',
  'sub_test_example',
  'failed',
  1,
  '{"source":"phase1_fake"}'::jsonb,
  'Sensitive raw provider error must never be copied',
  '2026-07-22T11:55:00Z',
  '2026-07-22T11:56:00Z',
  '2026-07-22T11:55:00Z',
  '2026-07-22T11:56:00Z'
),
(
  '77777777-7777-4777-8777-777777777753',
  'razorpay',
  'event_test_repeated',
  'subscription.updated',
  '55555555-5555-4555-8555-555555555553',
  '22222222-2222-4222-8222-222222222222',
  'sub_test_example',
  'failed',
  3,
  '{"source":"phase1_fake"}'::jsonb,
  'Sensitive raw provider error must never be copied',
  '2026-07-22T11:55:00Z',
  '2026-07-22T11:56:00Z',
  '2026-07-22T11:55:00Z',
  '2026-07-22T11:56:00Z'
),
(
  '77777777-7777-4777-8777-777777777754',
  'razorpay',
  'event_test_unprocessed',
  'subscription.charged',
  null,
  null,
  'sub_test_late',
  'received',
  0,
  '{"source":"phase1_fake"}'::jsonb,
  null,
  '2026-07-22T11:00:00Z',
  null,
  '2026-07-22T11:00:00Z',
  '2026-07-22T11:00:00Z'
),
(
  '77777777-7777-4777-8777-777777777755',
  'razorpay',
  'event_test_reconcile_failed',
  'subscription.active',
  '55555555-5555-4555-8555-555555555553',
  '22222222-2222-4222-8222-222222222222',
  'sub_test_example',
  'failed',
  1,
  '{"source":"provider_api_reconciliation"}'::jsonb,
  'Sensitive raw reconciliation error must never be copied',
  '2026-07-22T11:55:00Z',
  '2026-07-22T11:56:00Z',
  '2026-07-22T11:55:00Z',
  '2026-07-22T11:56:00Z'
);

set local role service_role;

create temporary table monitoring_subscription_snapshot on commit drop as
select id, status, provider_subscription_id, creation_attempt_id, creation_started_at, grace_period_end
from public.business_owner_subscriptions;

create temporary table monitoring_webhook_snapshot on commit drop as
select id, processing_status, processing_attempts, last_error, payload, processed_at
from public.subscription_webhook_events;

select is(
  public.detect_payment_monitoring_incidents('2026-07-22T12:00:00Z'),
  9,
  'detector records all observable Phase 1 incidents'
);
select throws_ok(
  $$select public.resolve_payment_monitoring_incident(
    (select id from public.payment_monitoring_incidents limit 1),
    ' '
  )$$,
  '22023',
  null,
  'empty resolution summaries are rejected'
);
select is(
  (select count(*) from public.payment_monitoring_incidents),
  9::bigint,
  'first detection creates one incident per source condition'
);
select is(
  (select severity from public.payment_monitoring_incidents where diagnostic_code = 'webhook_repeated_attempts'),
  'critical',
  'repeated webhook attempts are critical'
);
select is(
  (select severity from public.payment_monitoring_incidents where diagnostic_code = 'webhook_unprocessed'),
  'high',
  'old unprocessed webhook events are high severity'
);
select is(
  (select first_detected_at from public.payment_monitoring_incidents where diagnostic_code = 'subscription_creation_lease_stale'),
  '2026-07-22T12:00:00Z'::timestamptz,
  'fixed observation time is used for first detection'
);
select is(
  (select last_detected_at from public.payment_monitoring_incidents where diagnostic_code = 'subscription_grace_period_expired'),
  '2026-07-22T12:00:00Z'::timestamptz,
  'expired grace period is detected'
);
select is(
  (select diagnostic_code from public.payment_monitoring_incidents where incident_type = 'reconciliation_processing_failure' limit 1),
  'reconciliation_processing_failed',
  'reconciliation failures map to existing webhook audit rows'
);
select ok(
  not exists (
    select 1
    from public.payment_monitoring_incidents
    where resolution_summary like '%Sensitive%'
      or diagnostic_code like '%Sensitive%'
      or incident_key like '%Sensitive%'
  ),
  'raw provider errors are not copied into incidents'
);

select is(
  public.detect_payment_monitoring_incidents('2026-07-22T12:00:00Z'),
  9,
  're-running detection observes the same conditions'
);
select is(
  (select count(*) from public.payment_monitoring_incidents),
  9::bigint,
  're-running detection does not create open duplicates'
);
select is(
  (select detection_count from public.payment_monitoring_incidents where diagnostic_code = 'webhook_repeated_attempts'),
  2,
  're-detection increments detection_count'
);
select is(
  (select last_detected_at from public.payment_monitoring_incidents where diagnostic_code = 'webhook_repeated_attempts'),
  '2026-07-22T12:00:00Z'::timestamptz,
  're-detection updates last_detected_at'
);

select ok(public.record_payment_monitoring_incident(
  'subscription_creation_lease', 'warning', 'business_owner_subscriptions',
  '55555555-5555-4555-8555-555555555551',
  '22222222-2222-4222-8222-222222222222', null, null,
  'subscription_creation_lease_stale', '2026-07-22T12:01:00Z'
) is not null, 'warning observation upserts the existing incident');
select ok(public.record_payment_monitoring_incident(
  'subscription_creation_lease', 'critical', 'business_owner_subscriptions',
  '55555555-5555-4555-8555-555555555551',
  '22222222-2222-4222-8222-222222222222', null, null,
  'subscription_creation_lease_stale', '2026-07-22T12:02:00Z'
) is not null, 'critical observation upserts the existing incident');
select is(
  (select severity from public.payment_monitoring_incidents where diagnostic_code = 'subscription_creation_lease_stale'),
  'critical',
  'incident severity escalates'
);
select ok(public.record_payment_monitoring_incident(
  'subscription_creation_lease', 'warning', 'business_owner_subscriptions',
  '55555555-5555-4555-8555-555555555551',
  '22222222-2222-4222-8222-222222222222', null, null,
  'subscription_creation_lease_stale', '2026-07-22T12:03:00Z'
) is not null, 'lower-severity observation upserts without lowering severity');
select is(
  (select severity from public.payment_monitoring_incidents where diagnostic_code = 'subscription_creation_lease_stale'),
  'critical',
  'incident severity does not decrease automatically'
);

select is(
  public.resolve_payment_monitoring_incident(
    (select id from public.payment_monitoring_incidents where diagnostic_code = 'subscription_creation_lease_stale'),
    'Lease reviewed using sanitized operational evidence.'
  ),
  true,
  'incident resolution succeeds'
);
select is(
  (select status from public.payment_monitoring_incidents where diagnostic_code = 'subscription_creation_lease_stale' order by created_at limit 1),
  'resolved',
  'resolution preserves the incident row as resolved'
);
select is(
  (select resolution_summary from public.payment_monitoring_incidents where diagnostic_code = 'subscription_creation_lease_stale' order by created_at limit 1),
  'Lease reviewed using sanitized operational evidence.',
  'sanitized resolution summary is stored'
);
select is(
  public.resolve_payment_monitoring_incident(
    (select id from public.payment_monitoring_incidents where diagnostic_code = 'subscription_creation_lease_stale' order by created_at limit 1),
    'Repeated idempotent resolution.'
  ),
  true,
  'resolving an already resolved incident is idempotent'
);
select is(
  public.detect_payment_monitoring_incidents('2026-07-22T12:04:00Z'),
  9,
  'resolved conditions can be observed again without closing history'
);
select is(
  (select count(*) from public.payment_monitoring_incidents where diagnostic_code = 'subscription_creation_lease_stale'),
  2::bigint,
  'a resolved condition can create a new open incident'
);
select is(
  (select count(*) from public.payment_monitoring_incidents where diagnostic_code = 'subscription_creation_lease_stale' and status = 'open'),
  1::bigint,
  'the recurring incident is open again after re-detection'
);
select is(
  (select detection_count from public.payment_monitoring_incidents where diagnostic_code = 'subscription_creation_lease_stale' and status = 'open'),
  1,
  'a new post-resolution incident starts with count one'
);

select is(
  (
    select count(*)
    from monitoring_subscription_snapshot as before_row
    join public.business_owner_subscriptions as after_row using (id)
    where before_row.status is not distinct from after_row.status
      and before_row.provider_subscription_id is not distinct from after_row.provider_subscription_id
      and before_row.creation_attempt_id is not distinct from after_row.creation_attempt_id
      and before_row.creation_started_at is not distinct from after_row.creation_started_at
      and before_row.grace_period_end is not distinct from after_row.grace_period_end
  ),
  (select count(*) from monitoring_subscription_snapshot),
  'monitoring does not mutate subscription lifecycle rows'
);
select is(
  (
    select count(*)
    from monitoring_webhook_snapshot as before_row
    join public.subscription_webhook_events as after_row using (id)
    where before_row.processing_status is not distinct from after_row.processing_status
      and before_row.processing_attempts is not distinct from after_row.processing_attempts
      and before_row.last_error is not distinct from after_row.last_error
      and before_row.payload is not distinct from after_row.payload
      and before_row.processed_at is not distinct from after_row.processed_at
  ),
  (select count(*) from monitoring_webhook_snapshot),
  'monitoring does not mutate webhook audit rows'
);

select * from finish();
rollback;
