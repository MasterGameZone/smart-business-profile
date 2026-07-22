import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  fakeCreateSubscriptionResponse,
  fakeRazorpayIdentifiers,
} from '../fixtures/razorpay.ts'

vi.mock('../../lib/supabase.ts', () => ({
  supabase: {
    functions: { invoke: vi.fn() },
    rpc: vi.fn(),
  },
}))

const { supabase } = await import('../../lib/supabase.ts')
const {
  createRazorpaySubscription,
  getMyBusinessSubscription,
  reconcileRazorpaySubscription,
  verifyRazorpaySubscriptionCheckout,
} = await import('../../lib/businessSubscriptionService.ts')

const invoke = vi.mocked(supabase.functions.invoke)
const rpc = vi.mocked(supabase.rpc)

const mockRpcResponse = (data: unknown, error: unknown = null) => ({ data, error }) as never

const validCreateResponse = (environment: 'test' | 'live') => ({
  ok: true,
  data: {
    ...fakeCreateSubscriptionResponse,
    environment,
    keyId: environment === 'test' ? 'rzp_test_example' : 'rzp_live_example',
  },
})

const validSubscriptionRow = {
  plan_id: 'pro_analytics',
  subscription_status: 'active',
  billing_interval: 'monthly',
  currency: 'INR',
  amount_minor_units: 4500,
  current_period_start: '2026-07-01T00:00:00.000Z',
  current_period_end: '2026-08-01T00:00:00.000Z',
  cancel_at_period_end: false,
  grace_period_end: null,
  has_pro_access: true,
}

describe('business subscription response validation', () => {
  beforeEach(() => {
    invoke.mockReset()
    rpc.mockReset()
  })

  it.each(['test', 'live'] as const)('accepts a valid %s Checkout response', async (environment) => {
    invoke.mockResolvedValueOnce({ data: validCreateResponse(environment), error: null })

    await expect(createRazorpaySubscription()).resolves.toMatchObject({
      environment,
      keyId: environment === 'test' ? 'rzp_test_example' : 'rzp_live_example',
      subscriptionId: fakeRazorpayIdentifiers.subscriptionId,
    })
  })

  it.each([
    ['provider', 'stripe'],
    ['subscriptionId', 'pay_wrong_example'],
    ['amountMinorUnits', 4501],
    ['currency', 'USD'],
  ])('rejects an invalid Checkout field: %s', async (field, value) => {
    const data = { ...validCreateResponse('test').data, [field]: value }
    invoke.mockResolvedValueOnce({ data: { ok: true, data }, error: null })

    await expect(createRazorpaySubscription()).rejects.toMatchObject({ code: 'unknown_error' })
  })

  it('rejects a key prefix that does not match the environment', async () => {
    invoke.mockResolvedValueOnce({
      data: { ok: true, data: { ...validCreateResponse('live').data, keyId: 'rzp_test_example' } },
      error: null,
    })

    await expect(createRazorpaySubscription()).rejects.toMatchObject({ code: 'unknown_error' })
  })

  it.each(['checkoutName', 'checkoutDescription', 'subscriptionId'] as const)('rejects missing Checkout field %s', async (field) => {
    const data = Object.fromEntries(
      Object.entries(validCreateResponse('test').data).filter(([key]) => key !== field),
    )
    invoke.mockResolvedValueOnce({ data: { ok: true, data }, error: null })

    await expect(createRazorpaySubscription()).rejects.toMatchObject({ code: 'unknown_error' })
  })

  it('rejects malformed verification responses', async () => {
    invoke.mockResolvedValueOnce({ data: { ok: true, data: { verified: true } }, error: null })

    await expect(
      verifyRazorpaySubscriptionCheckout('pay_test_example', 'sub_test_example', 'a'.repeat(64)),
    ).rejects.toMatchObject({ code: 'unknown_error' })
  })

  it.each([
    'reconciled',
    'already_reconciled',
    'no_provider_subscription',
    'payment_not_confirmed',
    'manual_review_required',
    'provider_state_not_entitled',
  ] as const)('accepts reconciliation result %s', async (result) => {
    invoke.mockResolvedValueOnce({
      data: { ok: true, data: { result, status: 'active', hasPaidPeriod: result === 'reconciled' } },
      error: null,
    })

    await expect(reconcileRazorpaySubscription()).resolves.toEqual({
      result,
      status: 'active',
      hasPaidPeriod: result === 'reconciled',
    })
  })

  it.each([
    { result: 'unknown', status: 'active', hasPaidPeriod: false },
    { result: 'reconciled', status: 'unknown', hasPaidPeriod: true },
    { result: 'reconciled', status: 'active', hasPaidPeriod: 'yes' },
  ])('fails closed for malformed reconciliation data', async (data) => {
    invoke.mockResolvedValueOnce({ data: { ok: true, data }, error: null })

    await expect(reconcileRazorpaySubscription()).rejects.toMatchObject({ code: 'unknown_error' })
  })

  it('allows only the intentional empty RPC fallback to Free', async () => {
    rpc.mockResolvedValueOnce(mockRpcResponse(null))
    await expect(getMyBusinessSubscription()).resolves.toMatchObject({ planId: 'free', hasProAccess: false })

    rpc.mockResolvedValueOnce(mockRpcResponse([]))
    await expect(getMyBusinessSubscription()).resolves.toMatchObject({ planId: 'free', hasProAccess: false })
  })

  it.each([
    {},
    [{ ...validSubscriptionRow, subscription_status: 'unknown' }],
    [{ ...validSubscriptionRow, billing_interval: null }],
    [{ ...validSubscriptionRow, plan_id: 'free', subscription_status: 'active', has_pro_access: false }],
    [{ ...validSubscriptionRow, plan_id: 'free', subscription_status: 'free', billing_interval: null, has_pro_access: true }],
  ])('rejects malformed or inconsistent RPC rows', async (data) => {
    rpc.mockResolvedValueOnce(mockRpcResponse(data))
    await expect(getMyBusinessSubscription()).rejects.toThrow('Subscription access response was invalid.')
  })

  it('rejects RPC errors instead of falling back to Free', async () => {
    rpc.mockResolvedValueOnce(mockRpcResponse(null, { message: 'database unavailable' }))

    await expect(getMyBusinessSubscription()).rejects.toThrow('Unable to load subscription access.')
  })
})
