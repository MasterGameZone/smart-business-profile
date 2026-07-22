import { describe, expect, it } from 'vitest'

import {
  PROVIDER_STATUSES,
  SUPPORTED_WEBHOOK_EVENTS,
  parseWebhookCorrelationNotes,
  parseWebhookEnvelope,
  parseWebhookRpcResult,
  parseWebhookSubscriptionEntity,
  sanitizedWebhookPayload,
  webhookCorrelationMatchesRow,
  webhookEventStatusMatches,
  webhookPlanMatchesConfiguredPlan,
} from '../../../supabase/functions/_shared/razorpayWebhookValidation.ts'
import { fakeRazorpayUuid } from '../fixtures/razorpay.ts'

const config = { environment: 'test' as const }

const validNotes = {
  sbp_owner_id: fakeRazorpayUuid.ownerId,
  sbp_subscription_id: fakeRazorpayUuid.subscriptionId,
  sbp_plan_id: 'pro_analytics',
  sbp_creation_attempt_id: fakeRazorpayUuid.creationAttemptId,
  sbp_environment: 'test',
}

const validSubscription = {
  entity: 'subscription',
  id: 'sub_test_example',
  plan_id: 'plan_test_example',
  customer_id: 'cust_test_example',
  status: 'active',
  current_start: 1_751_328_000,
  current_end: 1_754_006_400,
  ended_at: null,
  quantity: 1,
  total_count: 120,
  customer_notify: true,
  notes: validNotes,
}

const validEnvelope = {
  entity: 'event',
  event: 'subscription.activated',
  created_at: 1_751_328_000,
  contains: ['subscription'],
  payload: { subscription: { entity: validSubscription } },
}

describe('Razorpay webhook validation', () => {
  it('parses valid envelopes and rejects malformed envelopes or missing subscription containment', () => {
    expect(parseWebhookEnvelope(validEnvelope)).not.toBeNull()
    expect(parseWebhookEnvelope({ ...validEnvelope, entity: 'not-event' })).toBeNull()
    expect(parseWebhookEnvelope({ ...validEnvelope, contains: undefined })).toBeNull()
    expect(parseWebhookEnvelope({ ...validEnvelope, payload: [] })).toBeNull()
  })

  it('accepts both authenticated and active status for authenticated events', () => {
    expect(webhookEventStatusMatches('subscription.authenticated', 'authenticated')).toBe(true)
    expect(webhookEventStatusMatches('subscription.authenticated', 'active')).toBe(true)
  })

  it.each([
    ['subscription.activated', 'active'],
    ['subscription.charged', 'active'],
    ['subscription.completed', 'completed'],
    ['subscription.pending', 'pending'],
    ['subscription.halted', 'halted'],
    ['subscription.cancelled', 'cancelled'],
    ['subscription.paused', 'paused'],
    ['subscription.resumed', 'active'],
  ] as const)('accepts expected status %s -> %s', (eventType, status) => {
    expect(webhookEventStatusMatches(eventType, status)).toBe(true)
  })

  it('allows every supported status for subscription.updated', () => {
    for (const status of PROVIDER_STATUSES) {
      expect(webhookEventStatusMatches('subscription.updated', status)).toBe(true)
    }
  })

  it('rejects invalid event/status combinations and leaves unsupported events for ignored handling', () => {
    expect(webhookEventStatusMatches('subscription.activated', 'pending')).toBe(false)
    expect(webhookEventStatusMatches('subscription.authenticated', 'pending')).toBe(false)
    expect(SUPPORTED_WEBHOOK_EVENTS.includes('subscription.ignored' as never)).toBe(false)
  })

  it.each([
    ['id', 'order_test_example'],
    ['plan_id', 'invalid_plan'],
    ['customer_id', 'customer_invalid'],
    ['quantity', 2],
    ['total_count', 12],
    ['customer_notify', false],
    ['current_start', -1],
    ['current_end', 1_751_328_000],
  ])('rejects malformed subscription entity field %s', (field, value) => {
    expect(parseWebhookSubscriptionEntity({ ...validSubscription, [field]: value }, config)).toBeNull()
  })

  it('requires valid current-period dates for active subscriptions', () => {
    expect(parseWebhookSubscriptionEntity({ ...validSubscription, current_start: null }, config)).toBeNull()
    expect(parseWebhookSubscriptionEntity({ ...validSubscription, current_end: null }, config)).toBeNull()
    expect(parseWebhookSubscriptionEntity({ ...validSubscription, current_end: 1_751_327_999 }, config)).toBeNull()
  })

  it('rejects missing or mismatched correlation notes and accepts only the configured environment', () => {
    expect(parseWebhookCorrelationNotes({}, config)).toBeNull()
    expect(parseWebhookCorrelationNotes({ ...validNotes, sbp_owner_id: 'owner_test_example' }, config)).toBeNull()
    expect(parseWebhookCorrelationNotes({ ...validNotes, sbp_plan_id: 'pro_other' }, config)).toBeNull()
    expect(parseWebhookCorrelationNotes({ ...validNotes, sbp_environment: 'live' }, config)).toBeNull()
    expect(parseWebhookSubscriptionEntity({ ...validSubscription, notes: {} }, config)).toBeNull()
  })

  it('rejects a validly shaped subscription when its plan differs from configured plan', () => {
    const subscription = parseWebhookSubscriptionEntity(validSubscription, config)
    expect(subscription).not.toBeNull()
    if (subscription === null) return
    expect(webhookPlanMatchesConfiguredPlan(subscription, 'plan_other_example')).toBe(false)
    expect(webhookPlanMatchesConfiguredPlan(subscription, 'plan_test_example')).toBe(true)
  })

  it('matches correlated rows only when owner, plan, provider, and IDs all agree', () => {
    const subscription = parseWebhookSubscriptionEntity(validSubscription, config)
    expect(subscription).not.toBeNull()
    if (subscription === null) return

    const row = {
      id: fakeRazorpayUuid.subscriptionId,
      owner_id: fakeRazorpayUuid.ownerId,
      plan_id: 'pro_analytics',
      billing_provider: 'razorpay',
      provider_subscription_id: 'sub_test_example',
      provider_plan_id: 'plan_test_example',
    }
    expect(webhookCorrelationMatchesRow(row, subscription, 'plan_test_example')).toBe(true)
    expect(webhookCorrelationMatchesRow({ ...row, owner_id: fakeRazorpayUuid.creationAttemptId }, subscription, 'plan_test_example')).toBe(false)
    expect(webhookCorrelationMatchesRow({ ...row, provider_plan_id: 'plan_other_example' }, subscription, 'plan_test_example')).toBe(false)
  })

  it('parses all supported RPC lifecycle results and rejects malformed rows', () => {
    const results = ['processed', 'duplicate', 'ignored', 'stale_event', 'subscription_not_found', 'plan_mismatch', 'failed'] as const
    for (const result of results) {
      expect(parseWebhookRpcResult([{
        result,
        webhook_event_id: fakeRazorpayUuid.webhookEventId,
        internal_subscription_id: fakeRazorpayUuid.subscriptionId,
        internal_status: 'active',
        processing_attempts: 1,
      }])?.result).toBe(result)
    }
    expect(parseWebhookRpcResult([])).toBeNull()
    expect(parseWebhookRpcResult([{ result: 'processed', webhook_event_id: 'event_test_example' }])).toBeNull()
  })

  it('sanitizes webhook payloads to subscription lifecycle data only', () => {
    const envelope = parseWebhookEnvelope(validEnvelope)
    const subscription = parseWebhookSubscriptionEntity(validSubscription, config)
    expect(envelope).not.toBeNull()
    expect(subscription).not.toBeNull()
    if (envelope === null || subscription === null) return

    const payload = sanitizedWebhookPayload(fakeRazorpayUuid.webhookEventId, envelope, subscription)
    const serialized = JSON.stringify(payload)
    expect(payload).toMatchObject({ subscription: { id: 'sub_test_example', plan_id: 'plan_test_example' } })
    expect(serialized).not.toMatch(/payment|card|mandate|phone|email/i)
  })
})
