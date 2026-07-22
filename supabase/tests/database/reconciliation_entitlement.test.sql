begin;

select plan(27);

insert into auth.users (id, aud, role, email, created_at, updated_at)
values
  ('11111111-1111-4111-8111-111111111111', 'authenticated', 'authenticated', 'reconcile-owner-a@example.test', now(), now()),
  ('22222222-2222-4222-8222-222222222222', 'authenticated', 'authenticated', 'reconcile-owner-b@example.test', now(), now()),
  ('33333333-3333-4333-8333-333333333333', 'authenticated', 'authenticated', 'reconcile-owner-c@example.test', now(), now());

insert into public.business_owner_subscriptions (
  id, owner_id, plan_id, billing_provider, provider_subscription_id, provider_plan_id, status
)
values
  ('55555555-5555-4555-8555-555555555555', '11111111-1111-4111-8111-111111111111', 'pro_analytics', 'razorpay', 'sub_test_example', 'plan_test_example', 'incomplete'),
  ('66666666-6666-4666-8666-666666666666', '22222222-2222-4222-8222-222222222222', 'pro_analytics', 'razorpay', 'sub_other_example', 'plan_test_example', 'incomplete');

set local role service_role;

select is((select result from public.reconcile_razorpay_subscription_snapshot(
  'event_test_reconcile_001', 'subscription.activated', '2026-04-01T00:00:00Z',
  'sub_test_example', 'plan_test_example', 'cust_test_example', 'active',
  '2099-01-01T00:00:00Z', '2099-02-01T00:00:00Z', null, true,
  '{"source":"provider_api_reconciliation","subscription":{"id":"sub_test_example"}}'::jsonb
)), 'processed', 'valid active reconciliation snapshot is processed');
select is((select status from public.business_owner_subscriptions where id = '55555555-5555-4555-8555-555555555555'), 'active', 'active reconciliation sets active status');
select ok((select current_period_end = '2099-02-01T00:00:00Z'::timestamptz from public.business_owner_subscriptions where id = '55555555-5555-4555-8555-555555555555'), 'active reconciliation stores future paid period');

select is((select result from public.reconcile_razorpay_subscription_snapshot(
  'event_test_reconcile_001', 'subscription.activated', '2026-04-01T00:00:00Z',
  'sub_test_example', 'plan_test_example', 'cust_test_example', 'active',
  '2099-01-01T00:00:00Z', '2099-02-01T00:00:00Z', null, true,
  '{"source":"provider_api_reconciliation","subscription":{"id":"sub_test_example"}}'::jsonb
)), 'duplicate', 'duplicate reconciliation event is reported as duplicate');
select is((select count(*)::integer from public.subscription_webhook_events where provider_event_id = 'event_test_reconcile_001'), 1, 'duplicate reconciliation event has one audit row');

select is((select result from public.reconcile_razorpay_subscription_snapshot(
  'event_test_reconcile_002', 'subscription.cancelled', '2026-04-02T00:00:00Z',
  'sub_test_example', 'plan_test_example', 'cust_test_example', 'cancelled',
  '2099-01-01T00:00:00Z', '2099-02-01T00:00:00Z', '2099-03-01T00:00:00Z', true,
  '{"source":"provider_api_reconciliation","subscription":{"id":"sub_test_example"}}'::jsonb
)), 'processed', 'canceled snapshot with paid future period is processed');
select is((select status from public.business_owner_subscriptions where id = '55555555-5555-4555-8555-555555555555'), 'canceled', 'canceled snapshot sets canceled status');
select ok((select current_period_end = '2099-02-01T00:00:00Z'::timestamptz and ended_at = '2099-03-01T00:00:00Z'::timestamptz from public.business_owner_subscriptions where id = '55555555-5555-4555-8555-555555555555'), 'canceled paid snapshot preserves period and ended fields');

select is((select result from public.reconcile_razorpay_subscription_snapshot(
  'event_test_reconcile_003', 'subscription.cancelled', '2026-04-03T00:00:00Z',
  'sub_test_example', 'plan_test_example', 'cust_test_example', 'cancelled',
  null, null, '2026-04-03T00:00:00Z', false,
  '{"source":"provider_api_reconciliation","subscription":{"id":"sub_test_example"}}'::jsonb
)), 'processed', 'canceled snapshot without paid period is processed');
select ok((select current_period_start is null and current_period_end is null from public.business_owner_subscriptions where id = '55555555-5555-4555-8555-555555555555'), 'canceled snapshot without paid period clears period fields');

select throws_ok($$select * from public.reconcile_razorpay_subscription_snapshot('event_test_bad_source', 'subscription.activated', '2026-05-01T00:00:00Z', 'sub_test_example', 'plan_test_example', null, 'active', '2099-01-01T00:00:00Z', '2099-02-01T00:00:00Z', null, true, '{"source":"raw_webhook"}'::jsonb)$$, '22023', 'Invalid reconciliation snapshot data.', 'invalid reconciliation source is rejected');
select throws_ok($$select * from public.reconcile_razorpay_subscription_snapshot('event_test_null_paid', 'subscription.activated', '2026-05-02T00:00:00Z', 'sub_test_example', 'plan_test_example', null, 'active', '2099-01-01T00:00:00Z', '2099-02-01T00:00:00Z', null, null, '{"source":"provider_api_reconciliation"}'::jsonb)$$, '22023', 'Invalid reconciliation snapshot data.', 'null paid-period confirmation is rejected');
select throws_ok($$select * from public.reconcile_razorpay_subscription_snapshot('event_test_past_period', 'subscription.activated', '2026-05-03T00:00:00Z', 'sub_test_example', 'plan_test_example', null, 'active', '2020-01-01T00:00:00Z', '2020-02-01T00:00:00Z', null, true, '{"source":"provider_api_reconciliation"}'::jsonb)$$, '22023', 'Invalid reconciliation snapshot data.', 'past paid period is rejected');
select throws_ok($$select * from public.reconcile_razorpay_subscription_snapshot('event_test_bad_range', 'subscription.activated', '2026-05-04T00:00:00Z', 'sub_test_example', 'plan_test_example', null, 'active', '2099-02-01T00:00:00Z', '2099-01-01T00:00:00Z', null, true, '{"source":"provider_api_reconciliation"}'::jsonb)$$, '22023', 'Invalid reconciliation snapshot data.', 'reversed paid period is rejected');
select throws_ok($$select * from public.reconcile_razorpay_subscription_snapshot('event_test_false_period', 'subscription.cancelled', '2026-05-05T00:00:00Z', 'sub_test_example', 'plan_test_example', null, 'cancelled', '2099-01-01T00:00:00Z', '2099-02-01T00:00:00Z', null, false, '{"source":"provider_api_reconciliation"}'::jsonb)$$, '22023', 'Invalid reconciliation snapshot data.', 'period fields with false paid confirmation are rejected');
select is((select result from public.reconcile_razorpay_subscription_snapshot(
  'event_test_reconcile_unknown', 'subscription.activated', '2026-05-06T00:00:00Z',
  'sub_unknown_example', 'plan_test_example', null, 'active',
  '2099-01-01T00:00:00Z', '2099-02-01T00:00:00Z', null, true,
  '{"source":"provider_api_reconciliation"}'::jsonb
)), 'subscription_not_found', 'unknown reconciliation subscription is classified safely');
select is((select result from public.reconcile_razorpay_subscription_snapshot(
  'event_test_reconcile_plan', 'subscription.activated', '2026-05-07T00:00:00Z',
  'sub_test_example', 'plan_other_example', null, 'active',
  '2099-01-01T00:00:00Z', '2099-02-01T00:00:00Z', null, true,
  '{"source":"provider_api_reconciliation"}'::jsonb
)), 'plan_mismatch', 'reconciliation Plan ID mismatch is classified safely');

reset role;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', '11111111-1111-4111-8111-111111111111', 'role', 'authenticated')::text, true);
select is((select has_pro_access from public.get_my_business_subscription()), false, 'canceled subscription without paid period has no Pro access');
reset role;

set local role service_role;
update public.business_owner_subscriptions
set status = 'active', current_period_start = now() - interval '1 day', current_period_end = now() + interval '30 days', grace_period_end = null
where id = '55555555-5555-4555-8555-555555555555';
reset role;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', '11111111-1111-4111-8111-111111111111', 'role', 'authenticated')::text, true);
select is((select has_pro_access from public.get_my_business_subscription()), true, 'active future period grants Pro access');
reset role;

set local role service_role;
update public.business_owner_subscriptions
set status = 'past_due', grace_period_end = now() + interval '2 days'
where id = '55555555-5555-4555-8555-555555555555';
reset role;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', '11111111-1111-4111-8111-111111111111', 'role', 'authenticated')::text, true);
select is((select has_pro_access from public.get_my_business_subscription()), true, 'past_due inside grace grants Pro access');
reset role;

set local role service_role;
update public.business_owner_subscriptions
set status = 'past_due', grace_period_end = now() - interval '1 second'
where id = '55555555-5555-4555-8555-555555555555';
reset role;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', '11111111-1111-4111-8111-111111111111', 'role', 'authenticated')::text, true);
select is((select has_pro_access from public.get_my_business_subscription()), false, 'past_due after grace has no Pro access');
reset role;

set local role service_role;
update public.business_owner_subscriptions
set status = 'incomplete', grace_period_end = null, current_period_start = null, current_period_end = null
where id = '55555555-5555-4555-8555-555555555555';
reset role;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', '11111111-1111-4111-8111-111111111111', 'role', 'authenticated')::text, true);
select is((select has_pro_access from public.get_my_business_subscription()), false, 'incomplete subscription has no Pro access');
reset role;

set local role service_role;
update public.business_owner_subscriptions
set status = 'canceled', current_period_start = now() - interval '1 day', current_period_end = now() + interval '30 days', grace_period_end = null
where id = '55555555-5555-4555-8555-555555555555';
reset role;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', '11111111-1111-4111-8111-111111111111', 'role', 'authenticated')::text, true);
select is((select has_pro_access from public.get_my_business_subscription()), true, 'canceled future period retains Pro access');
reset role;

set local role service_role;
update public.business_owner_subscriptions
set status = 'expired', current_period_start = null, current_period_end = null, grace_period_end = null
where id = '55555555-5555-4555-8555-555555555555';
reset role;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', '11111111-1111-4111-8111-111111111111', 'role', 'authenticated')::text, true);
select is((select has_pro_access from public.get_my_business_subscription()), false, 'expired subscription has no Pro access');
reset role;

set local role service_role;
update public.business_owner_subscriptions
set status = 'past_due', grace_period_end = null
where id = '55555555-5555-4555-8555-555555555555';
reset role;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', '11111111-1111-4111-8111-111111111111', 'role', 'authenticated')::text, true);
select is((select has_pro_access from public.get_my_business_subscription()), false, 'paused or locked mapping without grace has no Pro access');
reset role;

set local role service_role;
update public.business_owner_subscriptions
set status = 'active', current_period_start = now() - interval '1 day', current_period_end = now() + interval '30 days'
where owner_id = '22222222-2222-4222-8222-222222222222';
reset role;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', '33333333-3333-4333-8333-333333333333', 'role', 'authenticated')::text, true);
select is((select plan_id from public.get_my_business_subscription()), 'free', 'owner without a row cannot receive owner B entitlement');
select is((select has_pro_access from public.get_my_business_subscription()), false, 'owner without a row cannot receive owner B Pro access');
reset role;

select * from finish();
rollback;
