export type SubscriptionPlanId = 'free' | 'pro_analytics'

export type SubscriptionStatus =
  | 'free'
  | 'incomplete'
  | 'active'
  | 'past_due'
  | 'canceled'
  | 'expired'

export type SubscriptionBillingInterval = 'monthly' | null

export type EntitlementFeature =
  | 'public_profile'
  | 'customer_follow'
  | 'full_analytics'
  | 'customer_activity'
  | 'advanced_insights'

export interface BusinessSubscription {
  planId: SubscriptionPlanId
  status: SubscriptionStatus
  billingInterval: SubscriptionBillingInterval
  currency: string
  amountMinorUnits: number
  currentPeriodStart: string | null
  currentPeriodEnd: string | null
  cancelAtPeriodEnd: boolean
  gracePeriodEnd: string | null
  hasProAccess: boolean
}

export const FREE_BUSINESS_SUBSCRIPTION: BusinessSubscription = Object.freeze({
  planId: 'free',
  status: 'free',
  billingInterval: null,
  currency: 'INR',
  amountMinorUnits: 0,
  currentPeriodStart: null,
  currentPeriodEnd: null,
  cancelAtPeriodEnd: false,
  gracePeriodEnd: null,
  hasProAccess: false,
})
