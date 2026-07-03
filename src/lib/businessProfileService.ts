import { supabase } from './supabase'
import type { BusinessProfileInsert, BusinessProfileRow } from '../types/businessProfile'
import type { ProfileData } from '../context/ProfileContext'
import { slugify } from '../utils/slug'

export function mapProfileDataToInsert(
  data: ProfileData
): Omit<BusinessProfileInsert, 'slug'> {
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

async function slugExists(candidate: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('business_profiles')
    .select('id')
    .eq('slug', candidate)
    .maybeSingle()

  if (error) {
    throw error
  }

  return Boolean(data)
}

export async function generateUniqueSlug(businessName: string): Promise<string> {
  const baseSlug = slugify(businessName) || 'business'

  let candidate = baseSlug
  let suffix = 2

  while (await slugExists(candidate)) {
    candidate = `${baseSlug}-${suffix}`
    suffix += 1
  }

  return candidate
}

export async function insertBusinessProfile(
  data: ProfileData
): Promise<BusinessProfileRow> {
  const slug = await generateUniqueSlug(data.businessName)

  const payload: BusinessProfileInsert = {
    ...mapProfileDataToInsert(data),
    slug,
  }

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

export async function getBusinessProfileBySlug(
  slug: string
): Promise<BusinessProfileRow | null> {
  const { data, error } = await supabase
    .from('business_profiles')
    .select('*')
    .eq('slug', slug)
    .maybeSingle()

  if (error) {
    throw error
  }

  return data ?? null
}
