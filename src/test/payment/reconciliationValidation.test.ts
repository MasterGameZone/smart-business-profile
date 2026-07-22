import { describe, expect, it } from 'vitest'

import {
  fakeRazorpayApiConfig,
  fakeRazorpayUuid,
} from '../fixtures/razorpay.ts'
import {
  hasValidFuturePaidPeriod,
  parseInternalSubscription,
  parseInvoiceCollection,
  parsePaidInvoice,
  parsePayment,
  parseProviderSubscription,
  parseReconciliationLifecycleResult,
  sanitizedReconciliationPayload,
} from '../../../supabase/functions/_shared/razorpayReconciliationValidation.ts'

const createdAt = 1_782_864_000
const currentStart = 1_782_864_000
const currentEnd = 1_785_542_400

const internalSubscription = {
  id: fakeRazorpayUuid.subscriptionId,
  owner_id: fakeRazorpayUuid.ownerId,
  plan_id: 'pro_analytics',
  billing_provider: 'razorpay',
  provider_subscription_id: 'sub_test_example',
  provider_plan_id: 'plan_test_example',
  status: 'active',
}

const providerSubscription = {
  entity: 'subscription',
  id: 'sub_test_example',
  plan_id: 'plan_test_example',
  customer_id: 'cust_test_example',
  status: 'active',
  created_at: createdAt,
  current_start: currentStart,
  current_end: currentEnd,
  ended_at: null,
  paid_count: 1,
  total_count: 120,
  quantity: 1,
  customer_notify: true,
  notes: {
    sbp_owner_id: fakeRazorpayUuid.ownerId,
    sbp_subscription_id: fakeRazorpayUuid.subscriptionId,
    sbp_plan_id: 'pro_analytics',
    sbp_creation_attempt_id: fakeRazorpayUuid.creationAttemptId,
    sbp_environment: 'test',
  },
}

const invoice = {
  entity: 'invoice',
  id: 'inv_test_example',
  subscription_id: 'sub_test_example',
  status: 'paid',
  currency: 'INR',
  amount: 4500,
  amount_paid: 4500,
  amount_due: 0,
  payment_id: 'pay_test_example',
  order_id: 'order_test_example',
  paid_at: createdAt,
}

const payment = {
  entity: 'payment',
  id: 'pay_test_example',
  invoice_id: 'inv_test_example',
  order_id: 'order_test_example',
  amount_refunded: 0,
  refund_status: null,
  status: 'captured',
  captured: true,
  amount: 4500,
  currency: 'INR',
}

describe('Razorpay reconciliation validation', () => {
  it('parses a correlated internal subscription and rejects mismatches', () => {
    expect(parseInternalSubscription(internalSubscription, fakeRazorpayUuid.ownerId)).not.toBeNull()
    expect(parseInternalSubscription({ ...internalSubscription, owner_id: fakeRazorpayUuid.creationAttemptId }, fakeRazorpayUuid.ownerId)).toBeNull()
    expect(parseInternalSubscription({ ...internalSubscription, plan_id: 'free' }, fakeRazorpayUuid.ownerId)).toBeNull()
    expect(parseInternalSubscription({ ...internalSubscription, provider_subscription_id: 'pay_test_example' }, fakeRazorpayUuid.ownerId)).toBeNull()
  })

  it('validates provider subscription IDs, plan, quantity, count, timestamps, and correlation notes', () => {
    const internal = parseInternalSubscription(internalSubscription, fakeRazorpayUuid.ownerId)
    expect(internal).not.toBeNull()
    if (internal === null) return

    expect(parseProviderSubscription(providerSubscription, internal, fakeRazorpayApiConfig)).toMatchObject({
      id: 'sub_test_example',
      planId: 'plan_test_example',
      status: 'active',
      paidCount: 1,
    })

    for (const [field, value] of [
      ['id', 'sub_other_example'],
      ['plan_id', 'plan_other_example'],
      ['quantity', 2],
      ['total_count', 12],
      ['customer_notify', false],
      ['created_at', -1],
      ['paid_count', 121],
    ] as const) {
      expect(() => parseProviderSubscription({ ...providerSubscription, [field]: value }, internal, fakeRazorpayApiConfig)).toThrow()
    }
    expect(() => parseProviderSubscription({ ...providerSubscription, notes: { ...providerSubscription.notes, sbp_owner_id: fakeRazorpayUuid.creationAttemptId } }, internal, fakeRazorpayApiConfig)).toThrow()
    expect(() => parseProviderSubscription(providerSubscription, internal, { ...fakeRazorpayApiConfig, planId: 'plan_other_example' })).toThrow()
  })

  it('parses paid invoices and classifies payment confirmation safely', () => {
    expect(parseInvoiceCollection({ entity: 'collection', count: 1, items: [invoice] })).toHaveLength(1)
    expect(() => parseInvoiceCollection({ entity: 'collection', count: 2, items: [invoice] })).toThrow()
    const parsedInvoice = parsePaidInvoice(invoice, 'sub_test_example')
    expect(parsedInvoice).not.toBeNull()
    expect(parsePaidInvoice({ ...invoice, amount: 1 }, 'sub_test_example')).toBeNull()
    if (parsedInvoice === null) return

    expect(parsePayment(payment, parsedInvoice)).toEqual({ kind: 'verified', payment: { id: 'pay_test_example' } })
    expect(parsePayment({ ...payment, amount: 1 }, parsedInvoice)).toEqual({ kind: 'not_confirmed' })
    expect(parsePayment({ ...payment, amount_refunded: 1 }, parsedInvoice)).toEqual({ kind: 'manual_review_required' })
    expect(() => parsePayment({ ...payment, invoice_id: 'inv_other_example' }, parsedInvoice)).toThrow()
  })

  it('requires a verified payment and a valid future paid period before entitlement', () => {
    const internal = parseInternalSubscription(internalSubscription, fakeRazorpayUuid.ownerId)
    if (internal === null) return
    const parsedProvider = parseProviderSubscription(providerSubscription, internal, fakeRazorpayApiConfig)
    const parsedInvoice = parsePaidInvoice(invoice, 'sub_test_example')
    if (parsedInvoice === null) return

    expect(hasValidFuturePaidPeriod(parsedProvider, parsedInvoice, { kind: 'verified', payment: { id: 'pay_test_example' } })).toBe(true)
    expect(hasValidFuturePaidPeriod(parsedProvider, parsedInvoice, { kind: 'not_confirmed' })).toBe(false)
    expect(hasValidFuturePaidPeriod({ ...parsedProvider, currentEnd: parsedProvider.currentStart }, parsedInvoice, { kind: 'verified', payment: { id: 'pay_test_example' } })).toBe(false)
  })

  it('parses all lifecycle result classifications and rejects malformed RPC rows', () => {
    const results = ['processed', 'duplicate', 'ignored', 'stale_event', 'subscription_not_found', 'plan_mismatch', 'failed'] as const
    for (const result of results) {
      expect(parseReconciliationLifecycleResult([{
        result,
        webhook_event_id: fakeRazorpayUuid.webhookEventId,
        internal_subscription_id: fakeRazorpayUuid.subscriptionId,
        internal_status: 'active',
        processing_attempts: 0,
      }])?.result).toBe(result)
    }
    expect(parseReconciliationLifecycleResult([{ result: 'processed', webhook_event_id: 'event_test_example' }])).toBeNull()
    expect(parseReconciliationLifecycleResult([{ result: 'processed', webhook_event_id: fakeRazorpayUuid.webhookEventId, internal_subscription_id: null, internal_status: 'bad', processing_attempts: 0 }])).toBeNull()
  })

  it('sanitizes reconciliation data without sensitive provider fields', () => {
    const internal = parseInternalSubscription(internalSubscription, fakeRazorpayUuid.ownerId)
    if (internal === null) return
    const parsedProvider = parseProviderSubscription(providerSubscription, internal, fakeRazorpayApiConfig)
    const parsedInvoice = parsePaidInvoice(invoice, 'sub_test_example')
    if (parsedInvoice === null) return
    const payload = sanitizedReconciliationPayload(parsedProvider, parsedInvoice, { kind: 'verified', payment: { id: 'pay_test_example' } }, 'test', true)

    const serialized = JSON.stringify(payload)
    expect(payload).toMatchObject({ subscription: { id: 'sub_test_example', plan_id: 'plan_test_example' } })
    expect(serialized).not.toMatch(/card|mandate|phone|email/i)
  })
})
