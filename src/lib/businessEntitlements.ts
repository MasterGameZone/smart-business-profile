import type { BusinessSubscription, EntitlementFeature } from '../types/businessSubscription.ts'

export function canUseFeature(
  subscription: BusinessSubscription | null | undefined,
  feature: EntitlementFeature
): boolean {
  switch (feature) {
    case 'public_profile':
    case 'customer_follow':
      return true
    case 'full_analytics':
    case 'customer_activity':
    case 'advanced_insights':
      return subscription?.hasProAccess === true
  }
}
