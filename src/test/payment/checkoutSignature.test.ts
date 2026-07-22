import { beforeEach, describe, expect, it, vi } from 'vitest'

import { validateRazorpayCheckoutSuccess } from '../../lib/razorpayCheckout.ts'
import {
  buildRazorpayBasicAuthHeader,
  constantTimeEqual,
  hmacSha256Hex,
  verifyRazorpayCheckoutSignature,
  verifyRazorpayWebhookSignature,
} from '../../../supabase/functions/_shared/razorpay.ts'
import {
  fakeRazorpayApiConfig,
  fakeRazorpayLiveApiConfig,
  fakeRazorpaySecrets,
} from '../fixtures/razorpay.ts'

type FakeDeno = { env: { get: (name: string) => string | undefined } }

const setFakeEnvironment = (values: Record<string, string | undefined>) => {
  vi.stubGlobal('Deno', {
    env: { get: (name: string) => values[name] },
  } satisfies FakeDeno)
}

const checkoutSuccess = {
  razorpay_payment_id: 'pay_test_example',
  razorpay_subscription_id: 'sub_test_example',
  razorpay_signature: 'a'.repeat(64),
}

describe('Checkout response and signature validation', () => {
  beforeEach(() => {
    setFakeEnvironment({
      RAZORPAY_ENVIRONMENT: fakeRazorpayApiConfig.environment,
      RAZORPAY_KEY_ID: fakeRazorpayApiConfig.keyId,
      RAZORPAY_KEY_SECRET: fakeRazorpaySecrets.apiKeySecret,
      RAZORPAY_PLAN_ID: fakeRazorpayApiConfig.planId,
      RAZORPAY_WEBHOOK_SECRET: fakeRazorpaySecrets.webhookSecret,
    })
  })

  it('accepts a complete Checkout success response tied to the expected subscription', () => {
    expect(validateRazorpayCheckoutSuccess(checkoutSuccess, 'sub_test_example')).toEqual({
      paymentId: 'pay_test_example',
      subscriptionId: 'sub_test_example',
      signature: 'a'.repeat(64),
    })
  })

  it.each([
    {},
    { ...checkoutSuccess, razorpay_payment_id: '' },
    { ...checkoutSuccess, razorpay_payment_id: 'order_test_example' },
    { ...checkoutSuccess, razorpay_subscription_id: 'sub_other_example' },
    { ...checkoutSuccess, razorpay_signature: 'not-hex' },
    { ...checkoutSuccess, razorpay_signature: 'a'.repeat(63) },
  ])('rejects malformed Checkout success data', (value) => {
    expect(validateRazorpayCheckoutSuccess(value, 'sub_test_example')).toBeNull()
  })

  it.each([
    fakeRazorpayApiConfig,
    fakeRazorpayLiveApiConfig,
  ])('verifies checkout HMAC with the server-stored subscription ID for %s mode', async (config) => {
    setFakeEnvironment({
      RAZORPAY_ENVIRONMENT: config.environment,
      RAZORPAY_KEY_ID: config.keyId,
      RAZORPAY_KEY_SECRET: config.keySecret,
      RAZORPAY_PLAN_ID: config.planId,
    })
    const signature = await hmacSha256Hex('pay_test_example|sub_test_example', config.keySecret)

    await expect(
      verifyRazorpayCheckoutSignature('pay_test_example', 'sub_test_example', signature),
    ).resolves.toBe(true)
  })

  it.each([
    ['invalid signature', 'b'.repeat(64), 'sub_test_example'],
    ['malformed signature', 'not-hex', 'sub_test_example'],
    ['different subscription', 'a'.repeat(64), 'sub_other_example'],
  ])('rejects %s', async (_label, signature, expectedSubscriptionId) => {
    await expect(
      verifyRazorpayCheckoutSignature('pay_test_example', expectedSubscriptionId, signature),
    ).resolves.toBe(false)
  })

  it.each([
    ['', 'sub_test_example'],
    ['pay_test_example', ''],
  ])('rejects empty checkout identifiers', async (paymentId, subscriptionId) => {
    await expect(verifyRazorpayCheckoutSignature(paymentId, subscriptionId, 'a'.repeat(64))).resolves.toBe(false)
  })

  it('compares equal, unequal, and different-length byte arrays in constant time', () => {
    expect(constantTimeEqual(new Uint8Array([1, 2]), new Uint8Array([1, 2]))).toBe(true)
    expect(constantTimeEqual(new Uint8Array([1, 2]), new Uint8Array([1, 3]))).toBe(false)
    expect(constantTimeEqual(new Uint8Array([1, 2]), new Uint8Array([1]))).toBe(false)
  })

  it('verifies the exact raw webhook body without reserialization', async () => {
    const rawBody = '{"entity":"event", "created_at":123}'
    const signature = await hmacSha256Hex(rawBody, fakeRazorpaySecrets.webhookSecret)

    await expect(verifyRazorpayWebhookSignature(rawBody, signature)).resolves.toBe(true)
    await expect(verifyRazorpayWebhookSignature(JSON.stringify(JSON.parse(rawBody)), signature)).resolves.toBe(false)
  })

  it('fails safely when webhook configuration is missing or invalid', async () => {
    setFakeEnvironment({ RAZORPAY_ENVIRONMENT: 'live' })
    await expect(verifyRazorpayWebhookSignature('{}', 'a'.repeat(64))).rejects.toMatchObject({
      code: 'server_configuration_error',
    })

    setFakeEnvironment({
      RAZORPAY_ENVIRONMENT: 'other',
      RAZORPAY_WEBHOOK_SECRET: fakeRazorpaySecrets.webhookSecret,
    })
    await expect(verifyRazorpayWebhookSignature('{}', 'a'.repeat(64))).rejects.toMatchObject({
      code: 'server_configuration_error',
    })
  })

  it('builds Basic Authentication only from fake credentials', () => {
    expect(buildRazorpayBasicAuthHeader(fakeRazorpayApiConfig)).toBe(
      `Basic ${btoa('rzp_test_example:fake_key_secret')}`,
    )
  })
})
