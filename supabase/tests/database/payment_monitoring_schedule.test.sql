begin;

select no_plan();

select ok(
  exists (
    select 1
    from pg_extension
    where extname = 'pg_cron'
  ),
  'pg_cron is installed'
);
select is(
  pg_get_function_arguments('public.run_payment_monitoring_cycle(timestamptz)'::regprocedure),
  'p_observed_at timestamp with time zone DEFAULT now()',
  'wrapper has the audited argument signature'
);
select is(
  pg_get_function_result('public.run_payment_monitoring_cycle(timestamptz)'::regprocedure),
  'jsonb',
  'wrapper returns a sanitized JSON summary'
);
select ok(
  (
    select p.prosecdef
    from pg_proc as p
    where p.oid = 'public.run_payment_monitoring_cycle(timestamptz)'::regprocedure
  ),
  'wrapper is security definer'
);
select ok(
  (
    select 'search_path=""' = any(p.proconfig)
    from pg_proc as p
    where p.oid = 'public.run_payment_monitoring_cycle(timestamptz)'::regprocedure
  ),
  'wrapper has an empty search_path'
);
select is(
  (
    select pg_get_userbyid(p.proowner)
    from pg_proc as p
    where p.oid = 'public.run_payment_monitoring_cycle(timestamptz)'::regprocedure
  ),
  'postgres',
  'wrapper is owned by the database owner'
);
select is(
  has_function_privilege('anon', 'public.run_payment_monitoring_cycle(timestamptz)', 'execute'),
  false,
  'anon cannot execute the wrapper'
);
select is(
  has_function_privilege('authenticated', 'public.run_payment_monitoring_cycle(timestamptz)', 'execute'),
  false,
  'authenticated cannot execute the wrapper'
);
select is(
  has_function_privilege('service_role', 'public.run_payment_monitoring_cycle(timestamptz)', 'execute'),
  true,
  'service_role can execute the wrapper'
);
select is(
  has_function_privilege('postgres', 'public.run_payment_monitoring_cycle(timestamptz)', 'execute'),
  true,
  'the Cron execution role can execute the wrapper'
);

select is(
  (select count(*) from cron.job where jobname = 'payment-monitoring-detection'),
  1::bigint,
  'exactly one named monitoring job exists'
);
select is(
  (select schedule from cron.job where jobname = 'payment-monitoring-detection'),
  '*/5 * * * *',
  'monitoring job runs every five minutes'
);
select is(
  (select active from cron.job where jobname = 'payment-monitoring-detection'),
  true,
  'monitoring job is active'
);
select is(
  (select username from cron.job where jobname = 'payment-monitoring-detection'),
  'postgres',
  'monitoring job runs as the database owner'
);
select is(
  (select command from cron.job where jobname = 'payment-monitoring-detection'),
  'select public.run_payment_monitoring_cycle();',
  'monitoring job invokes only the schema-qualified wrapper'
);
select ok(
  (
    select command !~* '(https?://|api[_-]?key|authorization|token|vault|edge[_ -]?function|net\.http)'
    from cron.job
    where jobname = 'payment-monitoring-detection'
  ),
  'monitoring job command contains no network or secret material'
);
select ok(
  pg_get_functiondef('public.run_payment_monitoring_cycle(timestamptz)'::regprocedure)
    like '%pg_try_advisory_xact_lock%',
  'wrapper uses a non-blocking transaction-scoped advisory lock'
);
select ok(
  pg_get_functiondef('public.run_payment_monitoring_cycle(timestamptz)'::regprocedure)
    like '%smart-business-profile:payment-monitoring-cycle%',
  'wrapper uses a stable monitoring-specific lock key'
);
select is(
  (
    select count(*)
    from cron.job
    where jobname <> 'payment-monitoring-detection'
  ),
  0::bigint,
  'no unrelated local Cron jobs were changed'
);

-- Repeating the approved named-job operation must update the same job, not add one.
select ok(
  (
    select cron.schedule(
      'payment-monitoring-detection',
      '*/5 * * * *',
      'select public.run_payment_monitoring_cycle();'
    )
  ) is not null,
  'reapplying the named-job definition succeeds'
);
select is(
  (select count(*) from cron.job where jobname = 'payment-monitoring-detection'),
  1::bigint,
  'reapplying the named-job definition keeps one job'
);
select is(
  (select schedule from cron.job where jobname = 'payment-monitoring-detection'),
  '*/5 * * * *',
  'reapplying the named-job definition preserves the schedule'
);
select is(
  (select command from cron.job where jobname = 'payment-monitoring-detection'),
  'select public.run_payment_monitoring_cycle();',
  'reapplying the named-job definition preserves the command'
);

-- A transaction-scoped lock held by this transaction makes the wrapper skip.
-- Roll back before the normal execution transaction so the advisory lock releases.
insert into auth.users (id, aud, role, email, created_at, updated_at)
values (
  '22222222-2222-4222-8222-222222222223',
  'authenticated',
  'authenticated',
  'monitoring-schedule-owner@example.test',
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
  current_period_start,
  current_period_end,
  created_at,
  updated_at
)
values (
  '55555555-5555-4555-8555-555555555563',
  '22222222-2222-4222-8222-222222222223',
  'pro_analytics',
  'razorpay',
  'sub_test_schedule',
  'plan_test_schedule',
  'active',
  '2099-01-01T00:00:00Z',
  '2099-02-01T00:00:00Z',
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
  '77777777-7777-4777-8777-777777777763',
  'razorpay',
  'event_test_schedule_failed',
  'subscription.updated',
  '55555555-5555-4555-8555-555555555563',
  '22222222-2222-4222-8222-222222222223',
  'sub_test_schedule',
  'failed',
  1,
  '{"source":"phase2_fake"}'::jsonb,
  'Sensitive fake provider error must never be copied',
  '2026-07-22T11:55:00Z',
  '2026-07-22T11:56:00Z',
  '2026-07-22T11:55:00Z',
  '2026-07-22T11:56:00Z'
),
(
  '77777777-7777-4777-8777-777777777764',
  'razorpay',
  'event_test_schedule_reconcile',
  'subscription.active',
  '55555555-5555-4555-8555-555555555563',
  '22222222-2222-4222-8222-222222222223',
  'sub_test_schedule',
  'failed',
  1,
  '{"source":"provider_api_reconciliation"}'::jsonb,
  'Sensitive fake reconciliation error must never be copied',
  '2026-07-22T11:55:00Z',
  '2026-07-22T11:56:00Z',
  '2026-07-22T11:55:00Z',
  '2026-07-22T11:56:00Z'
);

set local role service_role;

create temporary table monitoring_schedule_subscription_before on commit drop as
select id, status, provider_subscription_id, current_period_start, current_period_end
from public.business_owner_subscriptions
where id = '55555555-5555-4555-8555-555555555563';

create temporary table monitoring_schedule_webhooks_before on commit drop as
select id, processing_status, processing_attempts, last_error, payload, processed_at,
  subscription_id, owner_id, provider_subscription_id
from public.subscription_webhook_events
where id in (
  '77777777-7777-4777-8777-777777777763',
  '77777777-7777-4777-8777-777777777764'
);

create temporary table monitoring_schedule_first_result on commit drop as
select public.run_payment_monitoring_cycle('2026-07-22T12:00:00Z') as summary;

select is(
  (select summary->>'outcome' from monitoring_schedule_first_result),
  'completed',
  'manual wrapper execution completes'
);
select is(
  ((select summary->>'observed_at' from monitoring_schedule_first_result)::timestamptz),
  '2026-07-22T12:00:00Z'::timestamptz,
  'wrapper passes one stable observed timestamp'
);
select is(
  ((select summary->>'incident_candidates_detected' from monitoring_schedule_first_result)::integer),
  2,
  'wrapper reports the actual Phase 1 detector count'
);
select is(
  (
    select array_agg(key order by key)
    from jsonb_object_keys((select summary from monitoring_schedule_first_result)) as key
  ),
  array['incident_candidates_detected', 'observed_at', 'outcome', 'skipped']::text[],
  'wrapper returns only sanitized summary fields'
);
select is(
  (select count(*) from public.payment_monitoring_incidents),
  2::bigint,
  'wrapper creates the expected sanitized incidents'
);
select ok(
  not exists (
    select 1
    from public.payment_monitoring_incidents
    where incident_key like '%Sensitive%'
      or diagnostic_code like '%Sensitive%'
      or resolution_summary like '%Sensitive%'
  ),
  'raw payload and error content are not stored in incidents'
);
select is(
  (select count(*) from public.payment_monitoring_incidents where status = 'resolved'),
  0::bigint,
  'wrapper does not resolve incidents automatically'
);

create temporary table monitoring_schedule_second_result on commit drop as
select public.run_payment_monitoring_cycle('2026-07-22T12:00:00Z') as summary;

select is(
  ((select summary->>'incident_candidates_detected' from monitoring_schedule_second_result)::integer),
  2,
  're-running the wrapper observes the same candidates'
);
select is(
  (select count(*) from public.payment_monitoring_incidents),
  2::bigint,
  're-running the wrapper does not create duplicate open incidents'
);
select is(
  (select detection_count from public.payment_monitoring_incidents where diagnostic_code = 'webhook_processing_failed'),
  2,
  're-running the wrapper refreshes the existing incident'
);

select is(
  (
    select count(*)
    from monitoring_schedule_subscription_before as before_row
    join public.business_owner_subscriptions as after_row using (id)
    where before_row.status is not distinct from after_row.status
      and before_row.provider_subscription_id is not distinct from after_row.provider_subscription_id
      and before_row.current_period_start is not distinct from after_row.current_period_start
      and before_row.current_period_end is not distinct from after_row.current_period_end
  ),
  1::bigint,
  'wrapper does not mutate subscription source rows'
);
select is(
  (
    select count(*)
    from monitoring_schedule_webhooks_before as before_row
    join public.subscription_webhook_events as after_row using (id)
    where before_row.processing_status is not distinct from after_row.processing_status
      and before_row.processing_attempts is not distinct from after_row.processing_attempts
      and before_row.last_error is not distinct from after_row.last_error
      and before_row.payload is not distinct from after_row.payload
      and before_row.processed_at is not distinct from after_row.processed_at
      and before_row.subscription_id is not distinct from after_row.subscription_id
      and before_row.owner_id is not distinct from after_row.owner_id
      and before_row.provider_subscription_id is not distinct from after_row.provider_subscription_id
  ),
  2::bigint,
  'wrapper does not mutate webhook or reconciliation source rows'
);

select * from finish();
rollback;
