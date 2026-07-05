import { supabase } from './supabase'
import type {
  BusinessProfileInsert,
  BusinessProfileRow,
  BusinessProfileUpdate,
  PublicBusinessProfileRow,
} from '../types/businessProfile'
import type { ProfileData } from '../context/ProfileContext'
import { workingDays, socialLinkFields } from '../context/ProfileContext'
import { slugify } from '../utils/slug'
import { getCurrentUser } from './authService'
import {
  uploadBusinessCover,
  uploadBusinessGalleryImage,
  uploadBusinessLogo,
  validateImageFile,
} from './storageService'

const MAX_GALLERY_IMAGES = 6

function parseServices(text: string): string[] {
  return text
    .split('\n')
    .map((service) => service.trim())
    .filter(Boolean)
}

function parseKeywords(text: string): string[] {
  const seen = new Set<string>()
  const keywords: string[] = []

  for (const keyword of text.split(',')) {
    const trimmed = keyword.trim()
    const key = trimmed.toLowerCase()
    if (!trimmed || seen.has(key)) continue

    seen.add(key)
    keywords.push(trimmed)
  }

  return keywords
}

function mapWorkingHours(data: ProfileData): Record<string, { open: string; close: string; closed: boolean }> | Record<string, never> {
  const hasWorkingHours = workingDays.some(({ key }) => {
    const day = data.workingHours[key]
    return day.closed || day.open.trim().length > 0 || day.close.trim().length > 0
  })

  if (!hasWorkingHours) return {}

  return workingDays.reduce<Record<string, { open: string; close: string; closed: boolean }>>((hours, { key }) => {
    const day = data.workingHours[key]
    hours[key] = {
      open: day.closed ? '' : day.open.trim(),
      close: day.closed ? '' : day.close.trim(),
      closed: day.closed,
    }
    return hours
  }, {})
}

function mapSocialLinks(data: ProfileData): Record<string, string> {
  return socialLinkFields.reduce<Record<string, string>>((links, { key }) => {
    const value = data.socialLinks[key].trim()
    if (value) {
      links[key] = value
    }
    return links
  }, {})
}

function mapProfileDataToFields(data: ProfileData) {
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
    tagline: data.tagline.trim() || null,
    services: parseServices(data.servicesText),
    working_hours: mapWorkingHours(data),
    google_maps_url: data.googleMapsUrl.trim() || null,
    social_links: mapSocialLinks(data),
    keywords: parseKeywords(data.keywordsText),
    cover_banner_url: data.existingCoverBannerUrl || null,
    gallery_images: data.existingGalleryImageUrls,
    is_public: data.isPublic,
  }
}

function validateImageBeforeProfileWrite(file: File | null): void {
  if (!file) return

  const validation = validateImageFile(file)
  if (!validation.valid) {
    throw new Error(validation.error || 'Invalid image file.')
  }
}

function validateImagesBeforeProfileWrite(data: ProfileData): void {
  validateImageBeforeProfileWrite(data.logo)
  validateImageBeforeProfileWrite(data.coverBanner)
  data.galleryImages.forEach((file) => validateImageBeforeProfileWrite(file))

  if (data.existingGalleryImageUrls.length + data.galleryImages.length > MAX_GALLERY_IMAGES) {
    throw new Error(`You can upload up to ${MAX_GALLERY_IMAGES} gallery images.`)
  }
}

async function uploadPendingProfileImages(
  ownerId: string,
  businessProfileId: string,
  data: ProfileData
): Promise<Pick<BusinessProfileUpdate, 'logo_url' | 'cover_banner_url' | 'gallery_images'>> {
  const updates: Pick<BusinessProfileUpdate, 'logo_url' | 'cover_banner_url' | 'gallery_images'> = {}

  if (data.logo) {
    const uploadedLogo = await uploadBusinessLogo({
      file: data.logo,
      ownerId,
      businessProfileId,
    })

    updates.logo_url = uploadedLogo.publicUrl
  }

  if (data.coverBanner) {
    const uploadedCover = await uploadBusinessCover({
      file: data.coverBanner,
      ownerId,
      businessProfileId,
    })

    updates.cover_banner_url = uploadedCover.publicUrl
  }

  if (data.galleryImages.length > 0) {
    const uploadedGalleryUrls: string[] = []

    for (const file of data.galleryImages) {
      const uploadedGalleryImage = await uploadBusinessGalleryImage({
        file,
        ownerId,
        businessProfileId,
      })

      uploadedGalleryUrls.push(uploadedGalleryImage.publicUrl)
    }

    updates.gallery_images = [...data.existingGalleryImageUrls, ...uploadedGalleryUrls]
  }

  return updates
}

export function mapProfileDataToInsert(
  data: ProfileData
): Omit<BusinessProfileInsert, 'slug'> {
  return {
    ...mapProfileDataToFields(data),
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
  const user = await getCurrentUser()
  if (!user) {
    throw new Error('You must be logged in to save a business profile.')
  }

  validateImagesBeforeProfileWrite(data)

  const slug = await generateUniqueSlug(data.businessName)

  const payload: BusinessProfileInsert = {
    ...mapProfileDataToInsert(data),
    slug,
    owner_id: user.id,
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

  const imageUpdates = await uploadPendingProfileImages(user.id, inserted.id, data)

  if (Object.keys(imageUpdates).length > 0) {
    const { data: updatedWithImages, error: imageUpdateError } = await supabase
      .from('business_profiles')
      .update(imageUpdates)
      .eq('id', inserted.id)
      .select()
      .single()

    if (imageUpdateError) {
      throw imageUpdateError
    }

    if (!updatedWithImages) {
      throw new Error('Image upload succeeded but the profile row was not returned.')
    }

    return updatedWithImages
  }

  return inserted
}

export async function updateBusinessProfile(
  id: string,
  data: ProfileData
): Promise<BusinessProfileRow> {
  const payload: BusinessProfileUpdate = mapProfileDataToFields(data)

  validateImagesBeforeProfileWrite(data)

  if (data.logo || data.coverBanner || data.galleryImages.length > 0) {
    const user = await getCurrentUser()
    if (!user) {
      throw new Error('You must be logged in to update business profile images.')
    }

    Object.assign(payload, await uploadPendingProfileImages(user.id, id, data))
  }

  const { data: updated, error } = await supabase
    .from('business_profiles')
    .update(payload)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    throw error
  }

  if (!updated) {
    throw new Error('Update succeeded but no row was returned.')
  }

  return updated
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

export async function getBusinessProfilesByOwner(
  ownerId: string
): Promise<BusinessProfileRow[]> {
  const { data, error } = await supabase
    .from('business_profiles')
    .select('*')
    .eq('owner_id', ownerId)
    .order('created_at', { ascending: false })

  if (error) {
    throw error
  }

  return data ?? []
}

export async function getPublicBusinessProfiles(): Promise<PublicBusinessProfileRow[]> {
  const { data, error } = await supabase
    .from('business_profiles')
    .select(
      'id, business_name, owner_name, business_category, address, about_business, logo_url, slug, owner_id, created_at, updated_at'
    )
    .eq('is_public', true)
    .order('business_name', { ascending: true })

  if (error) {
    throw error
  }

  return data ?? []
}
