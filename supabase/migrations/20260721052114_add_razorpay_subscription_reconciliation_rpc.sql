create function public.reconcile_razorpay_subscription_snapshot(
  p_provider_event_id text,
  p_event_type text,
  p_provider_created_at timestamp with time zone,
  p_provider_subscription_id text,
  p_provider_plan_id text,
  p_provider_customer_id text,
  p_provider_status text,
  p_current_period_start timestamp with time zone,
  p_current_period_end timestamp with time zone,
  p_ended_at timestamp with time zone,
  p_has_verified_paid_future_period boolean,
  p_sanitized_payload jsonb
)
returns table (
  result text,
  webhook_event_id uuid,
  internal_subscription_id uuid,
  internal_status text,
  processing_attempts integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_result text;
  v_webhook_event_id uuid;
  v_internal_subscription_id uuid;
  v_internal_status text;
  v_processing_attempts integer;
begin
  if p_has_verified_paid_future_period is null
    or pg_catalog.jsonb_typeof(p_sanitized_payload) is distinct from 'object'
    or p_sanitized_payload ->> 'source' is distinct from 'provider_api_reconciliation'
    or nullif(pg_catalog.btrim(p_provider_event_id), '') is null
    or nullif(pg_catalog.btrim(p_provider_subscription_id), '') is null
    or nullif(pg_catalog.btrim(p_provider_status), '') is null then
    raise exception using
      errcode = '22023',
      message = 'Invalid reconciliation snapshot data.';
  end if;

  if p_has_verified_paid_future_period then
    if p_current_period_start is null
      or p_current_period_end is null
      or p_current_period_end <= p_current_period_start
      or p_current_period_end <= pg_catalog.now() then
      raise exception using
        errcode = '22023',
        message = 'Invalid reconciliation snapshot data.';
    end if;
  elsif p_current_period_start is not null or p_current_period_end is not null then
    raise exception using
      errcode = '22023',
      message = 'Invalid reconciliation snapshot data.';
  end if;

  select
    lifecycle.result,
    lifecycle.webhook_event_id,
    lifecycle.internal_subscription_id,
    lifecycle.internal_status,
    lifecycle.processing_attempts
  into
    v_result,
    v_webhook_event_id,
    v_internal_subscription_id,
    v_internal_status,
    v_processing_attempts
  from public.process_razorpay_subscription_webhook(
    p_provider_event_id,
    p_event_type,
    p_provider_created_at,
    p_provider_subscription_id,
    p_provider_plan_id,
    p_provider_customer_id,
    p_provider_status,
    p_current_period_start,
    p_current_period_end,
    p_ended_at,
    p_sanitized_payload
  ) as lifecycle;

  if not found or v_result is null then
    raise exception using
      errcode = 'P0001',
      message = 'Reconciliation lifecycle processing failed.';
  end if;

  if p_provider_status = 'cancelled'
    and not p_has_verified_paid_future_period
    and v_result in ('processed', 'duplicate')
    and v_internal_subscription_id is not null then
    update public.business_owner_subscriptions as subscription
    set
      current_period_start = null,
      current_period_end = null
    where subscription.id = v_internal_subscription_id
      and subscription.billing_provider = 'razorpay'
      and subscription.provider_subscription_id = p_provider_subscription_id
      and subscription.status = 'canceled';
  end if;

  return query
  select
    v_result,
    v_webhook_event_id,
    v_internal_subscription_id,
    v_internal_status,
    v_processing_attempts;
end;
$$;

revoke all on function public.reconcile_razorpay_subscription_snapshot(
  text, text, timestamp with time zone, text, text, text, text,
  timestamp with time zone, timestamp with time zone, timestamp with time zone, boolean, jsonb
) from public;
revoke all on function public.reconcile_razorpay_subscription_snapshot(
  text, text, timestamp with time zone, text, text, text, text,
  timestamp with time zone, timestamp with time zone, timestamp with time zone, boolean, jsonb
) from anon;
revoke all on function public.reconcile_razorpay_subscription_snapshot(
  text, text, timestamp with time zone, text, text, text, text,
  timestamp with time zone, timestamp with time zone, timestamp with time zone, boolean, jsonb
) from authenticated;
grant execute on function public.reconcile_razorpay_subscription_snapshot(
  text, text, timestamp with time zone, text, text, text, text,
  timestamp with time zone, timestamp with time zone, timestamp with time zone, boolean, jsonb
) to service_role;

notify pgrst, 'reload schema';
