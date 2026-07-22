begin;

select plan(65);

insert into auth.users (id, aud, role, email, created_at, updated_at)
values ('11111111-1111-4111-8111-111111111111', 'authenticated', 'authenticated', 'webhook-owner@example.test', now(), now());

insert into public.business_owner_subscriptions (
  id, owner_id, plan_id, billing_provider, provider_subscription_id, provider_plan_id, status
)
values (
  '55555555-5555-4555-8555-555555555555',
  '11111111-1111-4111-8111-111111111111',
  'pro_analytics',
  'razorpay',
  'sub_test_example',
  'plan_test_example',
  'incomplete'
);

set local role service_role;

select is((select result from public.process_razorpay_subscription_webhook(
  'event_test_001', 'subscription.authenticated', '2026-01-01T00:00:00Z',
  'sub_test_example', 'plan_test_example', 'cust_test_example', 'authenticated',
  null, null, null, '{"source":"phase3_fake","subscription":{"id":"sub_test_example"}}'::jsonb
)), 'processed', 'authenticated event is processed');
select is((select status from public.business_owner_subscriptions where id = '55555555-5555-4555-8555-555555555555'), 'incomplete', 'authenticated state remains incomplete');
select is((select processing_status from public.subscription_webhook_events where provider_event_id = 'event_test_001'), 'processed', 'authenticated event is marked processed');
select is((select processing_attempts from public.subscription_webhook_events where provider_event_id = 'event_test_001'), 1, 'authenticated event has one processing attempt');

select is((select result from public.process_razorpay_subscription_webhook(
  'event_test_002', 'subscription.activated', '2026-01-02T00:00:00Z',
  'sub_test_example', 'plan_test_example', 'cust_test_example', 'active',
  '2099-01-01T00:00:00Z', '2099-02-01T00:00:00Z', null,
  '{"source":"phase3_fake","subscription":{"id":"sub_test_example"}}'::jsonb
)), 'processed', 'activated event is processed');
select is((select status from public.business_owner_subscriptions where id = '55555555-5555-4555-8555-555555555555'), 'active', 'active provider state activates subscription');
select ok((select current_period_start = '2099-01-01T00:00:00Z'::timestamptz and current_period_end = '2099-02-01T00:00:00Z'::timestamptz from public.business_owner_subscriptions where id = '55555555-5555-4555-8555-555555555555'), 'active event stores valid paid-period dates');
select is((select grace_period_end from public.business_owner_subscriptions where id = '55555555-5555-4555-8555-555555555555'), null, 'activation clears grace state');
select is((select owner_id from public.subscription_webhook_events where provider_event_id = 'event_test_002'), '11111111-1111-4111-8111-111111111111'::uuid, 'webhook owner correlation is stored');
select is((select subscription_id from public.subscription_webhook_events where provider_event_id = 'event_test_002'), '55555555-5555-4555-8555-555555555555'::uuid, 'webhook subscription correlation is stored');

select is((select result from public.process_razorpay_subscription_webhook(
  'event_test_003', 'subscription.charged', '2026-01-03T00:00:00Z',
  'sub_test_example', 'plan_test_example', 'cust_test_example', 'active',
  '2099-01-01T00:00:00Z', '2099-02-01T00:00:00Z', null,
  '{"source":"phase3_fake","subscription":{"id":"sub_test_example"}}'::jsonb
)), 'processed', 'charged event is processed');
select is((select status from public.business_owner_subscriptions where id = '55555555-5555-4555-8555-555555555555'), 'active', 'charged event keeps active status');

select is((select result from public.process_razorpay_subscription_webhook(
  'event_test_004', 'subscription.pending', '2026-01-04T00:00:00Z',
  'sub_test_example', 'plan_test_example', 'cust_test_example', 'pending',
  '2099-01-01T00:00:00Z', '2099-02-01T00:00:00Z', null,
  '{"source":"phase3_fake","subscription":{"id":"sub_test_example"}}'::jsonb
)), 'processed', 'pending event is processed');
select is((select status from public.business_owner_subscriptions where id = '55555555-5555-4555-8555-555555555555'), 'past_due', 'pending event creates past_due state');
select ok((select grace_period_end is not null from public.business_owner_subscriptions where id = '55555555-5555-4555-8555-555555555555'), 'pending event creates grace period');
select ok((select grace_period_end <= now() + interval '3 days' and grace_period_end > now() from public.business_owner_subscriptions where id = '55555555-5555-4555-8555-555555555555'), 'grace period is no longer than three days');
create temporary table grace_before_halted on commit drop as
select grace_period_end from public.business_owner_subscriptions where id = '55555555-5555-4555-8555-555555555555';

select is((select result from public.process_razorpay_subscription_webhook(
  'event_test_005', 'subscription.halted', '2026-01-05T00:00:00Z',
  'sub_test_example', 'plan_test_example', 'cust_test_example', 'halted',
  '2099-01-01T00:00:00Z', '2099-02-01T00:00:00Z', null,
  '{"source":"phase3_fake","subscription":{"id":"sub_test_example"}}'::jsonb
)), 'processed', 'halted event is processed');
select is((select status from public.business_owner_subscriptions where id = '55555555-5555-4555-8555-555555555555'), 'past_due', 'halted event remains past_due');
select is((select grace_period_end from public.business_owner_subscriptions where id = '55555555-5555-4555-8555-555555555555'), (select grace_period_end from grace_before_halted), 'halted event does not extend grace');

select is((select result from public.process_razorpay_subscription_webhook(
  'event_test_006', 'subscription.paused', '2026-01-06T00:00:00Z',
  'sub_test_example', 'plan_test_example', 'cust_test_example', 'paused',
  '2099-01-01T00:00:00Z', '2099-02-01T00:00:00Z', null,
  '{"source":"phase3_fake","subscription":{"id":"sub_test_example"}}'::jsonb
)), 'processed', 'paused event is processed');
select is((select status from public.business_owner_subscriptions where id = '55555555-5555-4555-8555-555555555555'), 'past_due', 'paused state follows current database mapping');
select is((select grace_period_end from public.business_owner_subscriptions where id = '55555555-5555-4555-8555-555555555555'), null, 'paused event clears grace');

select is((select result from public.process_razorpay_subscription_webhook(
  'event_test_007', 'subscription.resumed', '2026-01-07T00:00:00Z',
  'sub_test_example', 'plan_test_example', 'cust_test_example', 'active',
  '2099-03-01T00:00:00Z', '2099-04-01T00:00:00Z', null,
  '{"source":"phase3_fake","subscription":{"id":"sub_test_example"}}'::jsonb
)), 'processed', 'resumed event is processed');
select is((select status from public.business_owner_subscriptions where id = '55555555-5555-4555-8555-555555555555'), 'active', 'resumed active state restores access state');
select ok((select current_period_start = '2099-03-01T00:00:00Z'::timestamptz and current_period_end = '2099-04-01T00:00:00Z'::timestamptz from public.business_owner_subscriptions where id = '55555555-5555-4555-8555-555555555555'), 'resumed event restores paid-period fields');

select is((select result from public.process_razorpay_subscription_webhook(
  'event_test_008', 'subscription.cancelled', '2026-01-08T00:00:00Z',
  'sub_test_example', 'plan_test_example', 'cust_test_example', 'cancelled',
  '2099-03-01T00:00:00Z', '2099-04-01T00:00:00Z', '2099-05-01T00:00:00Z',
  '{"source":"phase3_fake","subscription":{"id":"sub_test_example"}}'::jsonb
)), 'processed', 'cancelled event is processed');
select is((select status from public.business_owner_subscriptions where id = '55555555-5555-4555-8555-555555555555'), 'canceled', 'cancelled event sets canceled status');
select ok((select canceled_at is not null and ended_at = '2099-05-01T00:00:00Z'::timestamptz from public.business_owner_subscriptions where id = '55555555-5555-4555-8555-555555555555'), 'cancelled event stores cancellation and ended timestamps');
select is((select current_period_end from public.business_owner_subscriptions where id = '55555555-5555-4555-8555-555555555555'), '2099-04-01T00:00:00Z'::timestamptz, 'cancellation preserves future paid-period end');

select is((select result from public.process_razorpay_subscription_webhook(
  'event_test_009', 'subscription.completed', '2026-01-09T00:00:00Z',
  'sub_test_example', 'plan_test_example', 'cust_test_example', 'completed',
  null, null, '2099-06-01T00:00:00Z',
  '{"source":"phase3_fake","subscription":{"id":"sub_test_example"}}'::jsonb
)), 'processed', 'completed event is processed');
select is((select status from public.business_owner_subscriptions where id = '55555555-5555-4555-8555-555555555555'), 'expired', 'completed state removes paid access');
select is((select ended_at from public.business_owner_subscriptions where id = '55555555-5555-4555-8555-555555555555'), '2099-06-01T00:00:00Z'::timestamptz, 'completed state stores ended timestamp');

select is((select result from public.process_razorpay_subscription_webhook(
  'event_test_010', 'subscription.updated', '2026-01-10T00:00:00Z',
  'sub_test_example', 'plan_test_example', 'cust_test_example', 'active',
  '2099-07-01T00:00:00Z', '2099-08-01T00:00:00Z', null,
  '{"source":"phase3_fake","subscription":{"id":"sub_test_example"}}'::jsonb
)), 'processed', 'updated event is processed');
select is((select status from public.business_owner_subscriptions where id = '55555555-5555-4555-8555-555555555555'), 'active', 'updated active provider state activates subscription');
select is((select processing_status from public.subscription_webhook_events where provider_event_id = 'event_test_010'), 'processed', 'updated event is marked processed');
select ok((select not (payload ? 'payment' or payload ? 'card' or payload ? 'mandate' or payload ? 'bank' or payload ? 'upi' or payload ? 'phone' or payload ? 'email' or payload ? 'signature' or payload ? 'raw_body') from public.subscription_webhook_events where provider_event_id = 'event_test_010'), 'stored webhook payload contains no sensitive keys');

select is((select result from public.process_razorpay_subscription_webhook(
  'event_test_010', 'subscription.updated', '2026-01-10T00:00:00Z',
  'sub_test_example', 'plan_test_example', 'cust_test_example', 'active',
  '2099-07-01T00:00:00Z', '2099-08-01T00:00:00Z', null,
  '{"source":"phase3_fake","subscription":{"id":"sub_test_example"}}'::jsonb
)), 'duplicate', 'exact replay returns duplicate');
select is((select count(*)::integer from public.subscription_webhook_events where provider_event_id = 'event_test_010'), 1, 'exact replay leaves one webhook event row');
select is((select processing_attempts from public.subscription_webhook_events where provider_event_id = 'event_test_010'), 1, 'exact replay does not process state twice');

select ok((select result in ('duplicate', 'failed') from public.process_razorpay_subscription_webhook(
  'event_test_010', 'subscription.activated', '2026-01-10T00:00:00Z',
  'sub_test_example', 'plan_test_example', 'cust_test_example', 'active',
  '2099-07-01T00:00:00Z', '2099-08-01T00:00:00Z', null,
  '{"source":"phase3_fake","subscription":{"id":"sub_test_example"}}'::jsonb
)), 'conflicting event type replay fails safely');
select ok((select result in ('duplicate', 'failed') from public.process_razorpay_subscription_webhook(
  'event_test_010', 'subscription.updated', '2026-01-10T00:00:00Z',
  'sub_other_example', 'plan_test_example', 'cust_test_example', 'active',
  '2099-07-01T00:00:00Z', '2099-08-01T00:00:00Z', null,
  '{"source":"phase3_fake","subscription":{"id":"sub_test_example"}}'::jsonb
)), 'conflicting subscription replay fails safely');
select ok((select result in ('duplicate', 'failed') from public.process_razorpay_subscription_webhook(
  'event_test_010', 'subscription.updated', '2026-01-11T00:00:00Z',
  'sub_test_example', 'plan_test_example', 'cust_test_example', 'active',
  '2099-07-01T00:00:00Z', '2099-08-01T00:00:00Z', null,
  '{"source":"phase3_fake","subscription":{"id":"sub_test_example"}}'::jsonb
)), 'conflicting timestamp replay fails safely');
select is((select status from public.business_owner_subscriptions where id = '55555555-5555-4555-8555-555555555555'), 'active', 'conflicting replay does not overwrite valid state');

set local role service_role;
update public.business_owner_subscriptions
set status = 'past_due', grace_period_end = now() - interval '1 second'
where id = '55555555-5555-4555-8555-555555555555';
select is((select result from public.process_razorpay_subscription_webhook(
  'event_test_011', 'subscription.pending', '2026-01-11T00:00:00Z',
  'sub_test_example', 'plan_test_example', 'cust_test_example', 'pending',
  '2099-07-01T00:00:00Z', '2099-08-01T00:00:00Z', null, '{"source":"phase3_fake"}'::jsonb
)), 'processed', 'pending after expired grace is processed');
select ok((select grace_period_end <= now() from public.business_owner_subscriptions where id = '55555555-5555-4555-8555-555555555555'), 'pending after grace expiry does not restore or extend grace');

select is((select result from public.process_razorpay_subscription_webhook(
  'event_test_020', 'subscription.updated', '2026-02-01T00:00:00Z',
  'sub_test_example', 'plan_test_example', 'cust_test_example', 'active',
  '2099-09-01T00:00:00Z', '2099-10-01T00:00:00Z', null,
  '{"source":"phase3_fake","subscription":{"id":"sub_test_example"}}'::jsonb
)), 'processed', 'newer event establishes authoritative state');
select is((select result from public.process_razorpay_subscription_webhook(
  'event_test_021', 'subscription.authenticated', '2026-01-31T00:00:00Z',
  'sub_test_example', 'plan_test_example', 'cust_test_example', 'authenticated',
  null, null, null, '{"source":"phase3_fake"}'::jsonb
)), 'stale_event', 'older authenticated event is stale');
select is((select result from public.process_razorpay_subscription_webhook(
  'event_test_022', 'subscription.activated', '2026-01-31T00:00:00Z',
  'sub_test_example', 'plan_test_example', 'cust_test_example', 'active',
  '2088-01-01T00:00:00Z', '2088-02-01T00:00:00Z', null, '{"source":"phase3_fake"}'::jsonb
)), 'stale_event', 'older active event is stale');
select is((select result from public.process_razorpay_subscription_webhook(
  'event_test_023', 'subscription.pending', '2026-01-31T00:00:00Z',
  'sub_test_example', 'plan_test_example', 'cust_test_example', 'pending',
  null, null, null, '{"source":"phase3_fake"}'::jsonb
)), 'stale_event', 'older pending event is stale');
select is((select result from public.process_razorpay_subscription_webhook(
  'event_test_024', 'subscription.paused', '2026-01-31T00:00:00Z',
  'sub_test_example', 'plan_test_example', 'cust_test_example', 'paused',
  null, null, null, '{"source":"phase3_fake"}'::jsonb
)), 'stale_event', 'older paused event is stale');
select is((select result from public.process_razorpay_subscription_webhook(
  'event_test_025', 'subscription.resumed', '2026-01-31T00:00:00Z',
  'sub_test_example', 'plan_test_example', 'cust_test_example', 'active',
  '2088-03-01T00:00:00Z', '2088-04-01T00:00:00Z', null, '{"source":"phase3_fake"}'::jsonb
)), 'stale_event', 'older resumed event is stale');
select is((select result from public.process_razorpay_subscription_webhook(
  'event_test_026', 'subscription.cancelled', '2026-01-31T00:00:00Z',
  'sub_test_example', 'plan_test_example', 'cust_test_example', 'cancelled',
  null, null, '2088-05-01T00:00:00Z', '{"source":"phase3_fake"}'::jsonb
)), 'stale_event', 'older canceled event is stale');
select is((select result from public.process_razorpay_subscription_webhook(
  'event_test_027', 'subscription.completed', '2026-01-31T00:00:00Z',
  'sub_test_example', 'plan_test_example', 'cust_test_example', 'completed',
  null, null, '2088-06-01T00:00:00Z', '{"source":"phase3_fake"}'::jsonb
)), 'stale_event', 'older completed event is stale');
select is((select status from public.business_owner_subscriptions where id = '55555555-5555-4555-8555-555555555555'), 'active', 'stale events cannot regress lifecycle state');
select is((select current_period_end from public.business_owner_subscriptions where id = '55555555-5555-4555-8555-555555555555'), '2099-10-01T00:00:00Z'::timestamptz, 'stale events cannot roll back current period');

select is((select result from public.process_razorpay_subscription_webhook(
  'event_test_unknown', 'subscription.activated', '2026-03-01T00:00:00Z',
  'sub_unknown_example', 'plan_test_example', 'cust_test_example', 'active',
  '2099-01-01T00:00:00Z', '2099-02-01T00:00:00Z', null, '{"source":"phase3_fake"}'::jsonb
)), 'subscription_not_found', 'unknown provider subscription is rejected');
select is((select result from public.process_razorpay_subscription_webhook(
  'event_test_plan_mismatch', 'subscription.activated', '2026-03-02T00:00:00Z',
  'sub_test_example', 'plan_other_example', 'cust_test_example', 'active',
  '2099-01-01T00:00:00Z', '2099-02-01T00:00:00Z', null, '{"source":"phase3_fake"}'::jsonb
)), 'plan_mismatch', 'provider Plan ID mismatch is rejected');
select is((select result from public.process_razorpay_subscription_webhook(
  'event_test_bad_range', 'subscription.activated', '2026-03-05T00:00:00Z',
  'sub_test_example', 'plan_test_example', 'cust_test_example', 'active',
  '2099-09-01T00:00:00Z', '2099-08-01T00:00:00Z', null, '{"source":"phase3_fake"}'::jsonb
)), 'failed', 'invalid current-period range fails without overwriting state');
select throws_ok($$select * from public.process_razorpay_subscription_webhook('event_test_array_payload', 'subscription.updated', '2026-03-06T00:00:00Z', 'sub_test_example', 'plan_test_example', null, 'active', null, null, null, '[]'::jsonb)$$, '22023', 'Invalid webhook event data.', 'non-object sanitized payload is rejected');
select throws_ok($$select * from public.process_razorpay_subscription_webhook('', 'subscription.updated', '2026-03-03T00:00:00Z', 'sub_test_example', 'plan_test_example', null, 'active', null, null, null, '{}'::jsonb)$$, '22023', 'Invalid webhook event data.', 'blank provider event ID is rejected');
select throws_ok($$select * from public.process_razorpay_subscription_webhook('event_test_invalid', '', '2026-03-03T00:00:00Z', 'sub_test_example', 'plan_test_example', null, 'active', null, null, null, '{}'::jsonb)$$, '22023', 'Invalid webhook event data.', 'blank event type is rejected');
select throws_ok($$select * from public.process_razorpay_subscription_webhook('event_test_invalid2', 'subscription.updated', null, 'sub_test_example', 'plan_test_example', null, 'active', null, null, null, '{}'::jsonb)$$, '22023', 'Invalid webhook event data.', 'missing provider-created timestamp is rejected');
select throws_ok($$select * from public.process_razorpay_subscription_webhook('event_test_invalid3', 'subscription.updated', '2026-03-03T00:00:00Z', 'sub_test_example', 'plan_test_example', null, 'unsupported', null, null, null, '{}'::jsonb)$$, '22023', 'Invalid webhook event data.', 'unsupported provider status is rejected');
select is((select result from public.process_razorpay_subscription_webhook(
  'event_test_ignored', 'subscription.unknown', '2026-03-04T00:00:00Z',
  'sub_test_example', 'plan_test_example', null, 'created', null, null, null,
  '{"source":"phase3_fake"}'::jsonb
)), 'ignored', 'unsupported event type is ignored');
select is((select processing_status from public.subscription_webhook_events where provider_event_id = 'event_test_ignored'), 'ignored', 'unsupported event is stored as ignored');

reset role;
select * from finish();
rollback;
