import { supabase } from './supabase.ts'

export type BusinessProfileActionType = 'call' | 'whatsapp' | 'directions' | 'website'

const businessProfileActionTypes: readonly BusinessProfileActionType[] = [
  'call',
  'whatsapp',
  'directions',
  'website',
]

function isBusinessProfileActionType(value: string): value is BusinessProfileActionType {
  return businessProfileActionTypes.includes(value as BusinessProfileActionType)
}

export async function trackBusinessProfileCustomerAction(
  profileId: string,
  actionType: BusinessProfileActionType,
  source = 'public_profile'
): Promise<void> {
  if (!profileId || !isBusinessProfileActionType(actionType)) return

  try {
    const { error } = await supabase.rpc('track_business_profile_customer_action', {
      target_profile_id: profileId,
      target_action_type: actionType,
      event_source: source,
    })

    if (error) {
      console.warn('Failed to track business profile customer action.', error)
    }
  } catch (error) {
    console.warn('Failed to track business profile customer action.', error)
  }
}

export async function getBusinessProfileActionCount(
  profileId: string,
  actionType: BusinessProfileActionType
): Promise<number> {
  if (!profileId || !isBusinessProfileActionType(actionType)) return 0

  try {
    const { data, error } = await supabase.rpc('get_business_profile_action_count', {
      target_profile_id: profileId,
      target_action_type: actionType,
    })

    if (error) {
      console.warn('Failed to load business profile customer action count.', error)
      return 0
    }

    const count = typeof data === 'number' ? data : Number(data)
    return Number.isFinite(count) ? count : 0
  } catch (error) {
    console.warn('Failed to load business profile customer action count.', error)
    return 0
  }
}
