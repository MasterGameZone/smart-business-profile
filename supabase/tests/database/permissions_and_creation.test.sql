begin;

select plan(55);

insert into auth.users (id, aud, role, email, created_at, updated_at)
values
  ('11111111-1111-4111-8111-111111111111', 'authenticated', 'authenticated', 'owner-a@example.test', now(), now()),
  ('22222222-2222-4222-8222-222222222222', 'authenticated', 'authenticated', 'owner-b@example.test', now(), now()),
  ('33333333-3333-4333-8333-333333333333', 'authenticated', 'authenticated', 'owner-c@example.test', now(), now()),
  ('44444444-4444-4444-8444-444444444444', 'authenticated', 'authenticated', 'owner-d@example.test', now(), now());

insert into public.user_account_preferences (user_id, owner_enabled, preferred_account_mode)
values
  ('11111111-1111-4111-8111-111111111111', true, 'business_owner'),
  ('22222222-2222-4222-8222-222222222222', true, 'business_owner'),
  ('44444444-4444-4444-8444-444444444444', true, 'business_owner');

insert into public.business_profiles (
  id, owner_id, business_name, owner_name, business_category, phone_number, slug
)
values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '11111111-1111-4111-8111-111111111111', 'Fake Owner A', 'Owner A', 'Services', '+910000000001', 'fake-owner-a'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', '22222222-2222-4222-8222-222222222222', 'Fake Owner B', 'Owner B', 'Services', '+910000000002', 'fake-owner-b');

insert into public.business_owner_subscriptions (
  id, owner_id, plan_id, billing_provider, provider_subscription_id, provider_plan_id, status
)
values (
  '66666666-6666-4666-8666-666666666666',
  '22222222-2222-4222-8222-222222222222',
  'pro_analytics',
  'razorpay',
  'sub_other_example',
  'plan_test_example',
  'incomplete'
);

select is(has_function_privilege('anon', 'public.claim_razorpay_subscription_creation(uuid)', 'EXECUTE'), false, 'anon cannot execute creation claim RPC');
select is(has_function_privilege('authenticated', 'public.claim_razorpay_subscription_creation(uuid)', 'EXECUTE'), false, 'authenticated cannot execute creation claim RPC');
select is(has_function_privilege('service_role', 'public.claim_razorpay_subscription_creation(uuid)', 'EXECUTE'), true, 'service_role can execute creation claim RPC');
select is(has_function_privilege('anon', 'public.finalize_razorpay_subscription_creation(uuid,uuid,text,text)', 'EXECUTE'), false, 'anon cannot execute creation finalization RPC');
select is(has_function_privilege('authenticated', 'public.finalize_razorpay_subscription_creation(uuid,uuid,text,text)', 'EXECUTE'), false, 'authenticated cannot execute creation finalization RPC');
select is(has_function_privilege('service_role', 'public.finalize_razorpay_subscription_creation(uuid,uuid,text,text)', 'EXECUTE'), true, 'service_role can execute creation finalization RPC');
select is(has_function_privilege('anon', 'public.release_razorpay_subscription_creation(uuid,uuid)', 'EXECUTE'), false, 'anon cannot execute lease release RPC');
select is(has_function_privilege('authenticated', 'public.release_razorpay_subscription_creation(uuid,uuid)', 'EXECUTE'), false, 'authenticated cannot execute lease release RPC');
select is(has_function_privilege('service_role', 'public.release_razorpay_subscription_creation(uuid,uuid)', 'EXECUTE'), true, 'service_role can execute lease release RPC');
select is(has_function_privilege('anon', 'public.process_razorpay_subscription_webhook(text,text,timestamptz,text,text,text,text,timestamptz,timestamptz,timestamptz,jsonb)', 'EXECUTE'), false, 'anon cannot execute webhook lifecycle RPC');
select is(has_function_privilege('authenticated', 'public.process_razorpay_subscription_webhook(text,text,timestamptz,text,text,text,text,timestamptz,timestamptz,timestamptz,jsonb)', 'EXECUTE'), false, 'authenticated cannot execute webhook lifecycle RPC');
select is(has_function_privilege('service_role', 'public.process_razorpay_subscription_webhook(text,text,timestamptz,text,text,text,text,timestamptz,timestamptz,timestamptz,jsonb)', 'EXECUTE'), true, 'service_role can execute webhook lifecycle RPC');
select is(has_function_privilege('anon', 'public.reconcile_razorpay_subscription_snapshot(text,text,timestamptz,text,text,text,text,timestamptz,timestamptz,timestamptz,boolean,jsonb)', 'EXECUTE'), false, 'anon cannot execute reconciliation RPC');
select is(has_function_privilege('authenticated', 'public.reconcile_razorpay_subscription_snapshot(text,text,timestamptz,text,text,text,text,timestamptz,timestamptz,timestamptz,boolean,jsonb)', 'EXECUTE'), false, 'authenticated cannot execute reconciliation RPC');
select is(has_function_privilege('service_role', 'public.reconcile_razorpay_subscription_snapshot(text,text,timestamptz,text,text,text,text,timestamptz,timestamptz,timestamptz,boolean,jsonb)', 'EXECUTE'), true, 'service_role can execute reconciliation RPC');
select is(has_function_privilege('anon', 'public.get_my_business_subscription()', 'EXECUTE'), false, 'anon cannot execute entitlement RPC');
select is(has_function_privilege('authenticated', 'public.get_my_business_subscription()', 'EXECUTE'), true, 'authenticated can execute entitlement RPC');
select is(has_table_privilege('anon', 'public.subscription_webhook_events', 'SELECT'), false, 'anon cannot read webhook events');
select is(has_table_privilege('authenticated', 'public.subscription_webhook_events', 'SELECT'), false, 'authenticated cannot read webhook events');
select is(has_table_privilege('authenticated', 'public.business_owner_subscriptions', 'INSERT'), false, 'authenticated cannot insert subscription lifecycle rows');
select is(has_table_privilege('authenticated', 'public.business_owner_subscriptions', 'UPDATE'), false, 'authenticated cannot update subscription lifecycle rows');
select is(has_table_privilege('authenticated', 'public.business_owner_subscriptions', 'DELETE'), false, 'authenticated cannot delete subscription lifecycle rows');

set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', '11111111-1111-4111-8111-111111111111', 'role', 'authenticated')::text, true);
select is((select plan_id from public.get_my_business_subscription()), 'free', 'authenticated owner without a row receives Free entitlement');
select is((select count(*)::integer from public.business_owner_subscriptions where owner_id = '22222222-2222-4222-8222-222222222222'), 0, 'owner cannot read another owner subscription through RLS');
select throws_ok(
  $$insert into public.business_owner_subscriptions (owner_id, plan_id, billing_provider) values ('11111111-1111-4111-8111-111111111111', 'pro_analytics', 'razorpay')$$,
  '42501', null, 'authenticated owner cannot insert lifecycle rows directly'
);
select throws_ok(
  $$update public.business_owner_subscriptions set status = 'active'$$,
  '42501', null, 'authenticated owner cannot update lifecycle rows directly'
);
select throws_ok(
  $$delete from public.business_owner_subscriptions$$,
  '42501', null, 'authenticated owner cannot delete lifecycle rows directly'
);
reset role;

set local role service_role;
create temporary table claim_initial on commit drop as
select * from public.claim_razorpay_subscription_creation('11111111-1111-4111-8111-111111111111');
select is((select decision from claim_initial), 'create', 'eligible owner receives a create decision');
select is((select internal_status from claim_initial), 'incomplete', 'new subscription is incomplete');
select is((select plan_id from public.business_owner_subscriptions where owner_id = '11111111-1111-4111-8111-111111111111'), 'pro_analytics', 'created row uses Pro Analytics plan');
select is((select billing_provider from public.business_owner_subscriptions where owner_id = '11111111-1111-4111-8111-111111111111'), 'razorpay', 'created row uses Razorpay provider');
select is((select billing_interval from public.business_owner_subscriptions where owner_id = '11111111-1111-4111-8111-111111111111'), 'monthly', 'created row uses monthly billing');
select is((select currency from public.business_owner_subscriptions where owner_id = '11111111-1111-4111-8111-111111111111'), 'INR', 'created row uses INR currency');
select is((select amount_minor_units from public.business_owner_subscriptions where owner_id = '11111111-1111-4111-8111-111111111111'), 4500, 'created row uses 4500 minor units');
select ok((select creation_attempt_id is not null from public.business_owner_subscriptions where owner_id = '11111111-1111-4111-8111-111111111111'), 'creation attempt ID is stored');
select ok((select creation_started_at is not null from public.business_owner_subscriptions where owner_id = '11111111-1111-4111-8111-111111111111'), 'creation start time is stored');
select is((select decision from public.claim_razorpay_subscription_creation('11111111-1111-4111-8111-111111111111')), 'in_progress', 'repeated claim during active lease is in progress');

update public.business_owner_subscriptions
set creation_started_at = now() - interval '6 minutes'
where owner_id = '11111111-1111-4111-8111-111111111111';
select is((select decision from public.claim_razorpay_subscription_creation('11111111-1111-4111-8111-111111111111')), 'inspect_existing', 'stale unresolved lease requires inspection');
select is(public.release_razorpay_subscription_creation('11111111-1111-4111-8111-111111111111', '99999999-9999-4999-8999-999999999999'), false, 'wrong lease claim is not released');
select is(public.release_razorpay_subscription_creation('11111111-1111-4111-8111-111111111111', (select creation_attempt_id from public.business_owner_subscriptions where owner_id = '11111111-1111-4111-8111-111111111111')), true, 'matching lease claim is released');
create temporary table claim_restarted on commit drop as
select * from public.claim_razorpay_subscription_creation('11111111-1111-4111-8111-111111111111');
select is((select decision from claim_restarted), 'create', 'released incomplete subscription can restart creation');
select is(public.finalize_razorpay_subscription_creation('11111111-1111-4111-8111-111111111111', '99999999-9999-4999-8999-999999999999', 'sub_test_example', 'plan_test_example'), false, 'wrong attempt ID does not finalize');
select is((select creation_attempt_id from public.business_owner_subscriptions where owner_id = '11111111-1111-4111-8111-111111111111'), (select creation_attempt_id from claim_restarted), 'wrong attempt ID does not mutate the lease');
select is(public.finalize_razorpay_subscription_creation('11111111-1111-4111-8111-111111111111', (select creation_attempt_id from claim_restarted), 'sub_test_example', 'plan_test_example'), true, 'matching attempt finalizes creation');
select is((select provider_subscription_id from public.business_owner_subscriptions where owner_id = '11111111-1111-4111-8111-111111111111'), 'sub_test_example', 'finalization stores provider subscription ID');
select is((select provider_plan_id from public.business_owner_subscriptions where owner_id = '11111111-1111-4111-8111-111111111111'), 'plan_test_example', 'finalization stores provider Plan ID');
select is((select status from public.business_owner_subscriptions where owner_id = '11111111-1111-4111-8111-111111111111'), 'incomplete', 'finalization leaves status incomplete');
select ok((select creation_attempt_id is null and creation_started_at is null from public.business_owner_subscriptions where owner_id = '11111111-1111-4111-8111-111111111111'), 'finalization clears the creation lease');

update public.business_owner_subscriptions
set status = 'active', current_period_start = now() - interval '1 day', current_period_end = now() + interval '30 days'
where owner_id = '11111111-1111-4111-8111-111111111111';
select is((select decision from public.claim_razorpay_subscription_creation('11111111-1111-4111-8111-111111111111')), 'blocked', 'active subscription blocks new creation');
update public.business_owner_subscriptions
set status = 'canceled', current_period_end = now() + interval '10 days'
where owner_id = '11111111-1111-4111-8111-111111111111';
select is((select decision from public.claim_razorpay_subscription_creation('11111111-1111-4111-8111-111111111111')), 'blocked', 'canceled subscription with paid access blocks new creation');
update public.business_owner_subscriptions
set status = 'expired', current_period_start = null, current_period_end = null, provider_subscription_id = 'sub_test_example'
where owner_id = '11111111-1111-4111-8111-111111111111';
select is((select decision from public.claim_razorpay_subscription_creation('11111111-1111-4111-8111-111111111111')), 'create', 'expired subscription can start new creation');
select is(public.release_razorpay_subscription_creation('11111111-1111-4111-8111-111111111111', (select creation_attempt_id from public.business_owner_subscriptions where owner_id = '11111111-1111-4111-8111-111111111111')), true, 'expired creation lease can be released');
update public.business_owner_subscriptions
set status = 'canceled', provider_subscription_id = null, provider_plan_id = null, current_period_start = null, current_period_end = null, ended_at = now()
where owner_id = '11111111-1111-4111-8111-111111111111';
select is((select decision from public.claim_razorpay_subscription_creation('11111111-1111-4111-8111-111111111111')), 'create', 'ended canceled subscription can start new creation');
select throws_ok(
  $$select * from public.claim_razorpay_subscription_creation('33333333-3333-4333-8333-333333333333')$$,
  '42501', 'Business owner is not eligible.', 'ineligible owner is rejected'
);
select throws_ok(
  $$select * from public.claim_razorpay_subscription_creation('44444444-4444-4444-8444-444444444444')$$,
  '42501', 'Business owner is not eligible.', 'owner without a business profile is rejected'
);
reset role;

select * from finish();
rollback;
