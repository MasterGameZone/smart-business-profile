import { supabase } from './supabase'
import type { BusinessProfileInsert, BusinessProfileRow } from '../types/businessProfile'
import type { ProfileData } from '../context/ProfileContext'

export function mapProfileDataToInsert(data: ProfileData): BusinessProfileInsert {
  return {
    business_name: data.businessName.trim(),
    owner_name: data.ownerName.trim(),
    business_category: data.businessCategory,
    phone_number: data.phoneNumber.trim(),
    whatsapp_number: data.whatsappNumber.trim() || null,
    email: data.email.trim() || null,
    website: data.website.trim() || null,
    address: data.address.trim() || null,
    about_business: data.aboutBusiness.trim() || null,
    logo_url: null,
  }
}

export async function insertBusinessProfile(
  data: ProfileData
): Promise<BusinessProfileRow> {
  const payload = mapProfileDataToInsert(data)

  const { data: inserted, error } = await supabase
    .from('business_profiles')
    .insert(payload)
    .select()
    .single()

  if (error) {
    throw error
  }

  if (!inserted) {
    throw new Error('Insert succeeded but no row was returned.')
  }

  return inserted
}
