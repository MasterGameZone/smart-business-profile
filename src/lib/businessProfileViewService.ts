import { supabase } from './supabase.ts'

const VISITOR_KEY_STORAGE_KEY = 'sb_profile_view_visitor_key'
let memoryVisitorKey: string | null = null

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
