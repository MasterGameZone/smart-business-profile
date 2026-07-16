import { supabase } from './supabase.ts'
import type { BusinessOwnerNotificationPreferenceRow } from '../types/businessOwnerNotificationPreference.ts'

const businessOwnerNotificationPreferenceSelect =
  'owner_id, notifications_enabled, created_at, updated_at'

export async function getBusinessOwnerNotificationPreference(
  ownerId: string
): Promise<BusinessOwnerNotificationPreferenceRow> {
  const { data, error } = await supabase
    .from('business_owner_notification_preferences')
    .select(businessOwnerNotificationPreferenceSelect)
    .eq('owner_id', ownerId)
    .maybeSingle()

  if (error) {
    throw error
  }

  if (data) {
    return data as BusinessOwnerNotificationPreferenceRow
  }

  const now = new Date().toISOString()

  return {
    owner_id: ownerId,
    notifications_enabled: true,
    created_at: now,
    updated_at: now,
  }
}

export async function upsertBusinessOwnerNotificationPreference(
  ownerId: string,
  notificationsEnabled: boolean
): Promise<BusinessOwnerNotificationPreferenceRow> {
  const { data, error } = await supabase
    .from('business_owner_notification_preferences')
    .upsert(
      {
        owner_id: ownerId,
        notifications_enabled: notificationsEnabled,
      },
      { onConflict: 'owner_id' }
    )
    .select(businessOwnerNotificationPreferenceSelect)
    .single()

  if (error) {
    throw error
  }

  return data as BusinessOwnerNotificationPreferenceRow
}
