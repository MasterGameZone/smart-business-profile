import type { RazorpayCheckoutSuccessResponse } from '../../lib/razorpayCheckout.ts'

export const fakeRazorpaySecrets = {
  apiKeySecret: 'fake_key_secret',
  webhookSecret: 'fake_webhook_secret',
} as const

export const fakeRazorpayUuid = {
  ownerId: '11111111-1111-4111-8111-111111111111',
  subscriptionId: '22222222-2222-4222-8222-222222222222',
  creationAttemptId: '33333333-3333-4333-8333-333333333333',
  webhookEventId: '44444444-4444-4444-8444-444444444444',
} as const

export const fakeRazorpayApiConfig = {
  environment: 'test',
  keyId: 'rzp_test_example',
  keySecret: fakeRazorpaySecrets.apiKeySecret,
  planId: 'plan_test_example',
} as const

export const fakeRazorpayLiveApiConfig = {
  ...fakeRazorpayApiConfig,
  environment: 'live',
  keyId: 'rzp_live_example',
} as const

export const fakeRazorpayPlan = {
  amountMinorUnits: 4500,
  checkoutDescription: 'Pro Analytics - Rs 45/month',
  checkoutName: 'Smart Business Profile',
  currency: 'INR',
  internalPlanId: 'pro_analytics',
  interval: 'monthly',
  providerPlanId: 'plan_test_example',
} as const

export const fakeRazorpayIdentifiers = {
  accountId: 'account_test_example',
  creationAttemptId: 'creation_attempt_test_example',
  eventId: 'event_test_example',
  invoiceId: 'inv_test_example',
  orderId: 'order_test_example',
  ownerId: 'owner_test_example',
  paymentId: 'pay_test_example',
  subscriptionId: 'sub_test_example',
} as const

export const fakeRazorpayCustomer = {
  email: 'owner@example.test',
  name: 'Example Owner',
  phone: '+919999999999',
} as const

export const fakeRazorpayCheckoutSuccess: RazorpayCheckoutSuccessResponse = {
  razorpay_payment_id: fakeRazorpayIdentifiers.paymentId,
  razorpay_signature: 'a'.repeat(64),
  razorpay_subscription_id: fakeRazorpayIdentifiers.subscriptionId,
}

export const fakeCreateSubscriptionResponse = {
  amountMinorUnits: fakeRazorpayPlan.amountMinorUnits,
  checkoutDescription: fakeRazorpayPlan.checkoutDescription,
  checkoutName: fakeRazorpayPlan.checkoutName,
  currency: fakeRazorpayPlan.currency,
  environment: 'test',
  keyId: 'rzp_test_example',
  provider: 'razorpay',
  reused: false,
  subscriptionId: fakeRazorpayIdentifiers.subscriptionId,
} as const

export const fakeWebhookMetadata = {
  eventId: fakeRazorpayIdentifiers.eventId,
  eventType: 'subscription.activated',
  providerStatus: 'active',
} as const
