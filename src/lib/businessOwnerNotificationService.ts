import { supabase } from './supabase.ts'
import { getBusinessProfileCompletion } from './profileCompletion.ts'
import type { BusinessProfileRow } from '../types/businessProfile.ts'
import type { BusinessOwnerNotificationRow } from '../types/businessOwnerNotification.ts'

const businessOwnerNotificationSelect =
  'id, owner_id, type, title, message, action_label, action_url, related_entity_type, related_entity_id, dedupe_key, is_read, read_at, created_at, updated_at'

export async function listBusinessOwnerNotifications(
  ownerId: string
): Promise<BusinessOwnerNotificationRow[]> {
  const { data, error } = await supabase
    .from('business_owner_notifications')
    .select(businessOwnerNotificationSelect)
    .eq('owner_id', ownerId)
    .order('created_at', { ascending: false })

  if (error) {
    throw error
  }

  return (data ?? []) as BusinessOwnerNotificationRow[]
}

export async function markBusinessOwnerNotificationRead(
  notificationId: string,
  ownerId: string
): Promise<BusinessOwnerNotificationRow> {
  const { data, error } = await supabase
    .from('business_owner_notifications')
    .update({
      is_read: true,
      read_at: new Date().toISOString(),
    })
    .eq('id', notificationId)
    .eq('owner_id', ownerId)
    .select(businessOwnerNotificationSelect)
    .single()

  if (error) {
    throw error
  }

  return data as BusinessOwnerNotificationRow
}

export async function ensureProfileUpdateReminderNotification(
  ownerId: string,
  profile: BusinessProfileRow | null | undefined
): Promise<void> {
  if (!profile?.id || getBusinessProfileCompletion(profile).isComplete) {
    return
  }

  const dedupeKey = `profile_update_reminder:${profile.id}`

  const { data: existingNotification, error: existingNotificationError } = await supabase
    .from('business_owner_notifications')
    .select('id')
    .eq('owner_id', ownerId)
    .eq('type', 'profile_update_reminder')
    .eq('dedupe_key', dedupeKey)
    .maybeSingle()

  if (existingNotificationError) {
    throw existingNotificationError
  }

  if (existingNotification) {
    return
  }

  const { error } = await supabase
    .from('business_owner_notifications')
    .insert({
      owner_id: ownerId,
      type: 'profile_update_reminder',
      title: 'Complete your business profile',
      message: 'Add missing details to make your profile more useful for customers.',
      action_label: 'Complete Profile',
      action_url: '/create-profile?step=basic',
      related_entity_type: 'business_profile',
      related_entity_id: profile.id,
      dedupe_key: dedupeKey,
    })

  if (error) {
    throw error
  }
}
