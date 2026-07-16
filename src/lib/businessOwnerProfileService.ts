import { supabase } from './supabase.ts'
import type {
  BusinessOwnerProfileFormValues,
  BusinessOwnerProfileRow,
} from '../types/businessOwnerProfile.ts'

const businessOwnerProfileSelect =
  'user_id, name, phone_number, preferred_city, created_at, updated_at'

function trimOptionalValue(value: string): string | null {
  const trimmedValue = value.trim()
  return trimmedValue || null
}

export async function getBusinessOwnerProfile(userId: string): Promise<BusinessOwnerProfileRow | null> {
  const { data, error } = await supabase
    .from('business_owner_profiles')
    .select(businessOwnerProfileSelect)
    .eq('user_id', userId)
    .maybeSingle()

  if (error) {
    throw error
  }

  return (data as BusinessOwnerProfileRow | null) ?? null
}

export async function upsertBusinessOwnerProfile(
  userId: string,
  values: BusinessOwnerProfileFormValues
): Promise<BusinessOwnerProfileRow> {
  const { data, error } = await supabase
    .from('business_owner_profiles')
    .upsert(
      {
        user_id: userId,
        name: trimOptionalValue(values.name),
        phone_number: trimOptionalValue(values.phoneNumber),
        preferred_city: trimOptionalValue(values.preferredCity),
      },
      { onConflict: 'user_id' }
    )
    .select(businessOwnerProfileSelect)
    .single()

  if (error) {
    throw error
  }

  return data as BusinessOwnerProfileRow
}
