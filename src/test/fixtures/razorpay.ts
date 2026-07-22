import type { RazorpayCheckoutSuccessResponse } from '../../lib/razorpayCheckout.ts'

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
