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

export interface RazorpaySubscriptionCheckoutData {
  provider: 'razorpay'
  environment: 'test' | 'live'
  keyId: string
  subscriptionId: string
  checkoutName: string
  checkoutDescription: string
  amountMinorUnits: 4500
  currency: 'INR'
  reused: boolean
}

export interface RazorpaySubscriptionVerificationResult {
  verified: true
  message: string
}

export type RazorpaySubscriptionReconciliationResult =
  | 'reconciled'
  | 'already_reconciled'
  | 'no_provider_subscription'
  | 'payment_not_confirmed'
  | 'manual_review_required'
  | 'provider_state_not_entitled'

export interface RazorpaySubscriptionReconciliationData {
  result: RazorpaySubscriptionReconciliationResult
  status: SubscriptionStatus
  hasPaidPeriod: boolean
}

const subscriptionFlowErrorMessages = {
  business_owner_not_eligible: 'Create a business profile before subscribing.',
  creation_in_progress: 'A subscription request is already being processed.',
  subscription_already_authorized:
    'Payment authorization was received. Subscription activation is being confirmed.',
  subscription_reconciliation_required:
    'We are checking a previous subscription request. Please wait before trying again.',
  subscription_outcome_unknown:
    'We are checking a previous subscription request. Please wait before trying again.',
  provider_temporarily_unavailable: 'Razorpay is temporarily unavailable. Please try again later.',
  invalid_checkout_signature: 'Payment verification failed. No subscription access was granted.',
  existing_subscription: 'A subscription already exists for this account.',
  existing_subscription_payment_issue:
    'Your existing subscription has a payment issue. Please check its payment status before trying again.',
  provider_request_failed: 'Razorpay could not process the subscription request. Please try again later.',
  invalid_checkout_response: 'The Checkout response was invalid. No subscription access was granted.',
  subscription_not_ready: 'The subscription is not ready for verification yet. Please wait and try again.',
  reconciliation_rejected: 'The subscription status could not be reconciled.',
  provider_state_not_found: 'The provider subscription could not be reconciled.',
  reconciliation_failed: 'The subscription status could not be refreshed. Please try again later.',
  server_configuration_error: 'Payments are temporarily unavailable. Please try again later.',
  unknown_error: 'The subscription request could not be completed.',
} as const

type SubscriptionFlowErrorCode = keyof typeof subscriptionFlowErrorMessages

export class BusinessSubscriptionFlowError extends Error {
  readonly code: SubscriptionFlowErrorCode

  constructor(code: SubscriptionFlowErrorCode) {
    super(subscriptionFlowErrorMessages[code])
    this.name = 'BusinessSubscriptionFlowError'
    this.code = code
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function isSubscriptionFlowErrorCode(value: unknown): value is SubscriptionFlowErrorCode {
  return (
    typeof value === 'string' &&
    Object.prototype.hasOwnProperty.call(subscriptionFlowErrorMessages, value)
  )
}

function getResponseErrorCode(value: unknown): SubscriptionFlowErrorCode | null {
  if (!isRecord(value)) {
    return null
  }

  const nestedError = isRecord(value.error) ? value.error : null
  const code = nestedError?.code ?? value.code
  return isSubscriptionFlowErrorCode(code) ? code : null
}

async function getFunctionErrorCode(error: unknown): Promise<SubscriptionFlowErrorCode> {
  const directCode = getResponseErrorCode(error)
  if (directCode) {
    return directCode
  }

  if (isRecord(error) && error.context instanceof Response) {
    try {
      const responseBody: unknown = await error.context.clone().json()
      const responseCode = getResponseErrorCode(responseBody)
      if (responseCode) {
        return responseCode
      }
    } catch {
      // Use the generic safe message when the function error body is unavailable.
    }
  }

  return 'unknown_error'
}

async function invokeSubscriptionFunction(functionName: string, body: Record<string, unknown>): Promise<unknown> {
  const { data, error } = await supabase.functions.invoke<unknown>(functionName, { body })

  if (error) {
    throw new BusinessSubscriptionFlowError(await getFunctionErrorCode(error))
  }

  return data
}

function isNonBlankString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function parseCreateSubscriptionResponse(value: unknown): RazorpaySubscriptionCheckoutData {
  const response = isRecord(value) ? value : null
  const data = response?.data

  if (response?.ok !== true || !isRecord(data)) {
    const responseErrorCode = getResponseErrorCode(value)
    throw new BusinessSubscriptionFlowError(responseErrorCode ?? 'unknown_error')
  }

  const environment = data.environment
  const keyId = data.keyId

  if (
    data.provider !== 'razorpay' ||
    (environment !== 'test' && environment !== 'live') ||
    !isNonBlankString(keyId) ||
    !isNonBlankString(data.subscriptionId) ||
    !data.subscriptionId.startsWith('sub_') ||
    !isNonBlankString(data.checkoutName) ||
    !isNonBlankString(data.checkoutDescription) ||
    data.amountMinorUnits !== 4500 ||
    data.currency !== 'INR' ||
    typeof data.reused !== 'boolean' ||
    !keyId.startsWith(environment === 'test' ? 'rzp_test_' : 'rzp_live_')
  ) {
    throw new BusinessSubscriptionFlowError('unknown_error')
  }

  return {
    provider: 'razorpay',
    environment,
    keyId,
    subscriptionId: data.subscriptionId,
    checkoutName: data.checkoutName,
    checkoutDescription: data.checkoutDescription,
    amountMinorUnits: 4500,
    currency: 'INR',
    reused: data.reused,
  }
}

function parseVerifySubscriptionResponse(value: unknown): RazorpaySubscriptionVerificationResult {
  const response = isRecord(value) ? value : null
  const data = response?.data

  if (
    response?.ok !== true ||
    !isRecord(data) ||
    data.verified !== true ||
    !isNonBlankString(data.message)
  ) {
    const responseErrorCode = getResponseErrorCode(value)
    throw new BusinessSubscriptionFlowError(responseErrorCode ?? 'unknown_error')
  }

  return {
    verified: true,
    message: data.message,
  }
}

const reconciliationResults: readonly RazorpaySubscriptionReconciliationResult[] = [
  'reconciled',
  'already_reconciled',
  'no_provider_subscription',
  'payment_not_confirmed',
  'manual_review_required',
  'provider_state_not_entitled',
]

function isReconciliationResult(value: unknown): value is RazorpaySubscriptionReconciliationResult {
  return typeof value === 'string' && reconciliationResults.includes(value as RazorpaySubscriptionReconciliationResult)
}

function parseReconcileSubscriptionResponse(value: unknown): RazorpaySubscriptionReconciliationData {
  const response = isRecord(value) ? value : null
  const data = response?.data

  if (
    response?.ok !== true ||
    !isRecord(data) ||
    !isReconciliationResult(data.result) ||
    !isSubscriptionStatus(data.status) ||
    typeof data.hasPaidPeriod !== 'boolean'
  ) {
    const responseErrorCode = getResponseErrorCode(value)
    throw new BusinessSubscriptionFlowError(responseErrorCode ?? 'unknown_error')
  }

  return {
    result: data.result,
    status: data.status,
    hasPaidPeriod: data.hasPaidPeriod,
  }
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

export async function createRazorpaySubscription(): Promise<RazorpaySubscriptionCheckoutData> {
  const response = await invokeSubscriptionFunction('create-razorpay-subscription', {})
  return parseCreateSubscriptionResponse(response)
}

export async function verifyRazorpaySubscriptionCheckout(
  razorpayPaymentId: string,
  razorpaySubscriptionId: string,
  razorpaySignature: string
): Promise<RazorpaySubscriptionVerificationResult> {
  const response = await invokeSubscriptionFunction('verify-razorpay-subscription-checkout', {
    razorpay_payment_id: razorpayPaymentId,
    razorpay_subscription_id: razorpaySubscriptionId,
    razorpay_signature: razorpaySignature,
  })

  return parseVerifySubscriptionResponse(response)
}

export async function reconcileRazorpaySubscription(): Promise<RazorpaySubscriptionReconciliationData> {
  const response = await invokeSubscriptionFunction('reconcile-razorpay-subscription', {})
  return parseReconcileSubscriptionResponse(response)
}
