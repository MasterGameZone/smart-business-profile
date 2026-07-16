import { supabase } from './supabase.ts'

const VISITOR_KEY_STORAGE_KEY = 'sb_profile_view_visitor_key'
let memoryVisitorKey: string | null = null

export type BusinessProfileViewActivityInterval = 'Daily' | 'Weekly' | 'Monthly'

export interface BusinessProfileViewActivityPoint {
  label: string
  value: number
}

const businessProfileViewActivityIntervalMap: Record<BusinessProfileViewActivityInterval, string> = {
  Daily: 'daily',
  Weekly: 'weekly',
  Monthly: 'monthly',
}

interface BusinessProfileViewActivityRpcRow {
  label?: unknown
  value?: unknown
}

function generateVisitorKey(): string {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID()
  }

  if (globalThis.crypto?.getRandomValues) {
    const values = new Uint32Array(4)
    globalThis.crypto.getRandomValues(values)
    return Array.from(values, (value) => value.toString(16).padStart(8, '0')).join('-')
  }

  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`
}

function getVisitorKey(): string | null {
  if (memoryVisitorKey) return memoryVisitorKey
  if (typeof window === 'undefined') return null

  try {
    const storedVisitorKey = window.localStorage.getItem(VISITOR_KEY_STORAGE_KEY)
    if (storedVisitorKey) {
      memoryVisitorKey = storedVisitorKey
      return storedVisitorKey
    }

    const generatedVisitorKey = generateVisitorKey()
    window.localStorage.setItem(VISITOR_KEY_STORAGE_KEY, generatedVisitorKey)
    memoryVisitorKey = generatedVisitorKey
    return generatedVisitorKey
  } catch {
    const generatedVisitorKey = generateVisitorKey()
    memoryVisitorKey = generatedVisitorKey
    return generatedVisitorKey
  }
}

export async function trackBusinessProfileView(profileId: string): Promise<void> {
  if (!profileId) return

  const visitorKey = getVisitorKey()
  if (!visitorKey) return

  try {
    const { error } = await supabase.rpc('track_business_profile_view', {
      target_profile_id: profileId,
      visitor_key: visitorKey,
      source: 'public_profile',
    })

    if (error) {
    console.warn('Failed to track business profile view.', error)
    }
  } catch (error) {
  console.warn('Failed to track business profile view.', error)
  }
}

export async function getBusinessProfileViewsCount(profileId: string): Promise<number> {
  if (!profileId) return 0

  try {
    const { data, error } = await supabase.rpc('get_business_profile_views_count', {
      target_profile_id: profileId,
    })

    if (error) {
      console.warn('Failed to load business profile view count.', error)
      return 0
    }

    const count = typeof data === 'number' ? data : Number(data)
    return Number.isFinite(count) ? count : 0
  } catch (error) {
    console.warn('Failed to load business profile view count.', error)
    return 0
  }
}

export async function getBusinessProfileViewActivity(
  profileId: string,
  interval: BusinessProfileViewActivityInterval
): Promise<BusinessProfileViewActivityPoint[]> {
  if (!profileId) return []

  try {
    const { data, error } = await supabase.rpc('get_business_profile_view_activity', {
      target_profile_id: profileId,
      activity_interval: businessProfileViewActivityIntervalMap[interval],
    })

    if (error) {
      console.warn('Failed to load business profile view activity.', error)
      return []
    }

    if (!Array.isArray(data)) {
      return []
    }

    return data.reduce<BusinessProfileViewActivityPoint[]>((points, row: BusinessProfileViewActivityRpcRow) => {
      if (typeof row.label !== 'string') {
        return points
      }

      const value = typeof row.value === 'number' ? row.value : Number(row.value)
      points.push({
        label: row.label,
        value: Number.isFinite(value) ? value : 0,
      })

      return points
    }, [])
  } catch (error) {
    console.warn('Failed to load business profile view activity.', error)
    return []
  }
}
