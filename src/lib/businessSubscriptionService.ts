import { supabase } from './supabase.ts'
import {
  FREE_BUSINESS_SUBSCRIPTION,
  type BusinessSubscription,
  type SubscriptionBillingInterval,
  type SubscriptionPlanId,
  type SubscriptionStatus,
} from '../types/businessSubscription.ts'

interface BusinessSubscriptionRpcRow {
  plan_id?: unknown
  subscription_status?: unknown
  billing_interval?: unknown
  currency?: unknown
  amount_minor_units?: unknown
  current_period_start?: unknown
  current_period_end?: unknown
  cancel_at_period_end?: unknown
  grace_period_end?: unknown
  has_pro_access?: unknown
}

const subscriptionPlanIds: readonly SubscriptionPlanId[] = ['free', 'pro_analytics']
const subscriptionStatuses: readonly SubscriptionStatus[] = [
  'free',
  'incomplete',
  'active',
  'past_due',
  'canceled',
  'expired',
]

function isSubscriptionPlanId(value: unknown): value is SubscriptionPlanId {
  return typeof value === 'string' && subscriptionPlanIds.includes(value as SubscriptionPlanId)
}

function isSubscriptionStatus(value: unknown): value is SubscriptionStatus {
  return typeof value === 'string' && subscriptionStatuses.includes(value as SubscriptionStatus)
}

function isBillingInterval(value: unknown): value is SubscriptionBillingInterval {
  return value === null || value === 'monthly'
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === 'string'
}

function isRpcRow(value: unknown): value is BusinessSubscriptionRpcRow {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function normalizeSubscription(row: BusinessSubscriptionRpcRow): BusinessSubscription {
  if (
    !isSubscriptionPlanId(row.plan_id) ||
    !isSubscriptionStatus(row.subscription_status) ||
    !isBillingInterval(row.billing_interval) ||
    typeof row.currency !== 'string' ||
    !row.currency.trim() ||
    typeof row.amount_minor_units !== 'number' ||
    !Number.isFinite(row.amount_minor_units) ||
    row.amount_minor_units < 0 ||
    !isNullableString(row.current_period_start) ||
    !isNullableString(row.current_period_end) ||
    typeof row.cancel_at_period_end !== 'boolean' ||
    !isNullableString(row.grace_period_end) ||
    typeof row.has_pro_access !== 'boolean'
  ) {
    throw new Error('Subscription access response was invalid.')
  }

  if (
    (row.plan_id === 'free' && (row.subscription_status !== 'free' || row.billing_interval !== null)) ||
    (row.plan_id === 'pro_analytics' && row.billing_interval !== 'monthly') ||
    (row.has_pro_access && (row.plan_id !== 'pro_analytics' || row.subscription_status === 'free'))
  ) {
    throw new Error('Subscription access response was invalid.')
  }

  return {
    planId: row.plan_id,
    status: row.subscription_status,
    billingInterval: row.billing_interval,
    currency: row.currency.trim(),
    amountMinorUnits: row.amount_minor_units,
    currentPeriodStart: row.current_period_start,
    currentPeriodEnd: row.current_period_end,
    cancelAtPeriodEnd: row.cancel_at_period_end,
    gracePeriodEnd: row.grace_period_end,
    hasProAccess: row.has_pro_access,
  }
}

export async function getMyBusinessSubscription(): Promise<BusinessSubscription> {
  const { data, error } = await supabase.rpc('get_my_business_subscription')

  if (error) {
    throw new Error('Unable to load subscription access.')
  }

  if (data === null || data === undefined) {
    return FREE_BUSINESS_SUBSCRIPTION
  }

  if (!Array.isArray(data)) {
    throw new Error('Subscription access response was invalid.')
  }

  if (data.length === 0) {
    return FREE_BUSINESS_SUBSCRIPTION
  }

  const row: unknown = data[0]
  if (!isRpcRow(row)) {
    throw new Error('Subscription access response was invalid.')
  }

  return normalizeSubscription(row)
}
