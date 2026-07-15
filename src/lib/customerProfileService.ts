import { supabase } from './supabase.ts'
import type { CustomerProfileFormValues, CustomerProfileRow } from '../types/customerProfile.ts'

const customerProfileSelect =
  'user_id, customer_name, phone_number, preferred_city, preferred_area, created_at, updated_at'

function trimOptionalValue(value: string): string | null {
  const trimmedValue = value.trim()
  return trimmedValue || null
}

export async function getCustomerProfile(userId: string): Promise<CustomerProfileRow | null> {
  const { data, error } = await supabase
    .from('customer_profiles')
    .select(customerProfileSelect)
    .eq('user_id', userId)
    .maybeSingle()

  if (error) {
    throw error
  }

  return (data as CustomerProfileRow | null) ?? null
}

export async function saveCustomerProfile(
  userId: string,
  values: CustomerProfileFormValues
): Promise<CustomerProfileRow> {
  const { data, error } = await supabase
    .from('customer_profiles')
    .upsert(
      {
        user_id: userId,
        customer_name: trimOptionalValue(values.customerName),
        phone_number: trimOptionalValue(values.phoneNumber),
        preferred_city: trimOptionalValue(values.preferredCity),
        preferred_area: trimOptionalValue(values.preferredArea),
      },
      { onConflict: 'user_id' }
    )
    .select(customerProfileSelect)
    .single()

  if (error) {
    throw error
  }

  return data as CustomerProfileRow
}
