import type { BusinessProfileRow, PublicBusinessProfileRow } from '../types/businessProfile'

export interface RecentlyViewedBusiness {
  id: string
  slug: string
  business_name: string
  business_category: string
  address: string | null
  logo_url: string | null
  owner_name: string
  viewed_at: string
}

const STORAGE_KEY_PREFIX = 'smart-business-profile:recently-viewed:'
const MAX_RECENTLY_VIEWED = 6

function getStorageKey(userId: string): string {
  return `${STORAGE_KEY_PREFIX}${userId}`
}

function isRecentlyViewedBusiness(value: unknown): value is RecentlyViewedBusiness {
  if (!value || typeof value !== 'object') return false

  const candidate = value as Record<string, unknown>
  return (
    typeof candidate.id === 'string' &&
    typeof candidate.slug === 'string' &&
    typeof candidate.business_name === 'string' &&
    typeof candidate.business_category === 'string' &&
    (typeof candidate.address === 'string' || candidate.address === null) &&
    (typeof candidate.logo_url === 'string' || candidate.logo_url === null) &&
    typeof candidate.owner_name === 'string' &&
    typeof candidate.viewed_at === 'string'
  )
}

export function getRecentlyViewedBusinesses(userId: string): RecentlyViewedBusiness[] {
  if (typeof window === 'undefined') return []

  const rawValue = window.localStorage.getItem(getStorageKey(userId))
  if (!rawValue) return []

  try {
    const parsed = JSON.parse(rawValue)
    if (!Array.isArray(parsed)) {
      window.localStorage.removeItem(getStorageKey(userId))
      return []
    }

    const validItems = parsed.filter(isRecentlyViewedBusiness)
    if (validItems.length !== parsed.length) {
      window.localStorage.setItem(getStorageKey(userId), JSON.stringify(validItems))
    }

    return validItems
  } catch {
    window.localStorage.removeItem(getStorageKey(userId))
    return []
  }
}

export function saveRecentlyViewedBusiness(userId: string, profile: BusinessProfileRow): void {
  if (typeof window === 'undefined') return

  const nextItem: RecentlyViewedBusiness = {
    id: profile.id,
    slug: profile.slug,
    business_name: profile.business_name,
    business_category: profile.business_category,
    address: profile.address,
    logo_url: profile.logo_url,
    owner_name: profile.owner_name,
    viewed_at: new Date().toISOString(),
  }

  const existingItems = getRecentlyViewedBusinesses(userId)
  const deduplicatedItems = existingItems.filter((item) => item.id !== nextItem.id && item.slug !== nextItem.slug)
  const limitedItems = [nextItem, ...deduplicatedItems].slice(0, MAX_RECENTLY_VIEWED)

  window.localStorage.setItem(getStorageKey(userId), JSON.stringify(limitedItems))
}

export function mapRecentlyViewedToPublicProfile(item: RecentlyViewedBusiness): PublicBusinessProfileRow {
  return {
    id: item.id,
    business_name: item.business_name,
    owner_name: item.owner_name,
    business_category: item.business_category,
    address: item.address,
    about_business: null,
    logo_url: item.logo_url,
    slug: item.slug,
    owner_id: '',
    created_at: item.viewed_at,
    updated_at: item.viewed_at,
  }
}
