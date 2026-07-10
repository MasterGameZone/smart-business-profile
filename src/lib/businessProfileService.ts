import { supabase } from './supabase'
import type {
  BusinessProfileDocumentRow,
  BusinessProfileFaqValue,
  BusinessProfileInsert,
  BusinessProfileProductValue,
  BusinessProfileQualificationValue,
  BusinessProfileRow,
  BusinessProfileUpdate,
  PublicBusinessProfileRow,
} from '../types/businessProfile'
import type { ProfileData, ProfileQualificationItem } from '../context/ProfileContext'
import { workingDays } from '../context/ProfileContext'
import { slugify } from '../utils/slug'
import { getCurrentUser } from './authService'
import {
  removeBusinessDocument,
  uploadBusinessCover,
  uploadBusinessDocument,
  uploadBusinessGalleryImage,
  uploadBusinessLogo,
  validateDocumentFile,
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

function parseOptionalYear(value: string): number | null {
  const trimmed = value.trim()
  if (!trimmed) return null

  const year = Number(trimmed)
  if (!Number.isInteger(year)) return null

  return year
}

function parseOptionalNonNegativeInteger(value: string): number | null {
  const trimmed = value.trim()
  if (!trimmed) return null

  const numericValue = Number(trimmed)
  if (!Number.isInteger(numericValue) || numericValue < 0) return null

  return numericValue
}

function parseHighlights(values: string[]): string[] {
  const seen = new Set<string>()
  const highlights: string[] = []

  values.forEach((value) => {
    const trimmed = value.trim()
    const key = trimmed.toLowerCase()
    if (!trimmed || seen.has(key)) return

    seen.add(key)
    highlights.push(trimmed)
  })

  return highlights
}

function parseFaqs(data: ProfileData): BusinessProfileFaqValue[] {
  return data.faqs
    .map((item) => ({
      question: item.question.trim(),
      answer: item.answer.trim(),
    }))
    .filter((item) => item.question && item.answer)
}

function parseProductsMenuPackages(data: ProfileData): BusinessProfileProductValue[] {
  return data.productsMenuPackages
    .map((item) => ({
      name: item.name.trim(),
      description: item.description.trim(),
      price: item.price.trim() || null,
    }))
    .filter((item) => item.name && item.description)
}

function parseQualifications(data: ProfileData): BusinessProfileQualificationValue[] {
  return data.qualifications
    .map((item) => ({
      title: item.title.trim(),
      issuingOrganization: item.issuingOrganization.trim() || null,
      year: parseOptionalYear(item.year),
      description: item.description.trim() || null,
      documentFileName: item.documentFilePath.trim() ? item.documentFileName.trim() || null : null,
      documentFilePath: item.documentFilePath.trim() || null,
      documentMimeType: item.documentFilePath.trim() ? item.documentMimeType.trim() || null : null,
    }))
    .filter(
      (item) =>
        item.title ||
        item.issuingOrganization ||
        item.year !== null ||
        item.description ||
        item.documentFilePath
    )
    .filter((item) => item.title)
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
  return Object.entries(data.socialLinks).reduce<Record<string, string>>((links, [key, value]) => {
    const trimmedKey = key.trim()
    const trimmedValue = value.trim()

    if (trimmedKey && trimmedValue) {
      links[trimmedKey] = trimmedValue
    }

    return links
  }, {})
}

function mapProfileDataToFields(data: ProfileData) {
  return {
    business_name: data.businessName.trim(),
    owner_name: data.ownerName.trim(),
    business_category: data.businessCategory,
    business_subcategories: data.businessSubcategories.length > 0 ? data.businessSubcategories : null,
    established_year: parseOptionalYear(data.establishedYear),
    years_of_experience: parseOptionalNonNegativeInteger(data.yearsOfExperience),
    highlights: parseHighlights(data.highlights),
    faqs: parseFaqs(data),
    products_menu_packages: parseProductsMenuPackages(data),
    qualifications: parseQualifications(data),
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

function validateDocumentBeforeProfileWrite(file: File): void {
  const validation = validateDocumentFile(file)
  if (!validation.valid) {
    throw new Error(validation.error || 'Invalid document file.')
  }
}

function validateImagesBeforeProfileWrite(data: ProfileData): void {
  validateImageBeforeProfileWrite(data.logo)
  validateImageBeforeProfileWrite(data.coverBanner)
  data.galleryImages.forEach((file) => validateImageBeforeProfileWrite(file))
  data.documentFiles.forEach((file) => validateDocumentBeforeProfileWrite(file))
  data.qualifications.forEach((item) => {
    if (item.documentFile) {
      validateDocumentBeforeProfileWrite(item.documentFile)
    }
  })

  if (data.existingGalleryImageUrls.length + data.galleryImages.length > MAX_GALLERY_IMAGES) {
    throw new Error(`You can upload up to ${MAX_GALLERY_IMAGES} gallery images.`)
  }
}

async function uploadPendingQualificationDocuments(
  ownerId: string,
  businessProfileId: string,
  data: ProfileData
): Promise<ProfileQualificationItem[] | null> {
  if (!data.qualifications.some((item) => item.documentFile)) {
    return null
  }

  const qualifications: ProfileQualificationItem[] = []

  for (const item of data.qualifications) {
    if (!item.documentFile) {
      qualifications.push(item)
      continue
    }

    const uploadedDocument = await uploadBusinessDocument({
      file: item.documentFile,
      ownerId,
      businessProfileId,
    })

    qualifications.push({
      ...item,
      documentFile: null,
      documentFileName: item.documentFile.name,
      documentFilePath: uploadedDocument.path,
      documentMimeType: item.documentFile.type,
    })
  }

  return qualifications
}

export async function getBusinessProfileDocuments(
  businessProfileId: string
): Promise<BusinessProfileDocumentRow[]> {
  const { data, error } = await supabase
    .from('business_profile_documents')
    .select('*')
    .eq('business_profile_id', businessProfileId)
    .order('created_at', { ascending: true })

  if (error) {
    throw error
  }

  return data ?? []
}

async function syncBusinessProfileDocuments(
  ownerId: string,
  businessProfileId: string,
  data: ProfileData
): Promise<void> {
  const existingDocuments = await getBusinessProfileDocuments(businessProfileId)
  const retainedDocumentIds = new Set(data.existingDocuments.map((document) => document.id))
  const removedDocuments = existingDocuments.filter((document) => !retainedDocumentIds.has(document.id))

  if (removedDocuments.length > 0) {
    const { error: deleteMetadataError } = await supabase
      .from('business_profile_documents')
      .delete()
      .in('id', removedDocuments.map((document) => document.id))

    if (deleteMetadataError) {
      throw deleteMetadataError
    }

    await Promise.all(
      removedDocuments.map(async (document) => {
        try {
          await removeBusinessDocument(document.file_path)
        } catch (error) {
          console.error('Failed to remove business document file:', error)
        }
      })
    )
  }

  if (data.documentFiles.length === 0) {
    return
  }

  const insertedDocuments = []

  for (const file of data.documentFiles) {
    const uploadedDocument = await uploadBusinessDocument({
      file,
      ownerId,
      businessProfileId,
    })

    insertedDocuments.push({
      business_profile_id: businessProfileId,
      owner_id: ownerId,
      document_name: data.documentName.trim() || null,
      file_name: file.name,
      file_path: uploadedDocument.path,
      mime_type: file.type,
    })
  }

  const { error: insertMetadataError } = await supabase
    .from('business_profile_documents')
    .insert(insertedDocuments)

  if (insertMetadataError) {
    throw insertMetadataError
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
  const uploadedQualifications = await uploadPendingQualificationDocuments(user.id, inserted.id, data)

  await syncBusinessProfileDocuments(user.id, inserted.id, data)

  const postInsertUpdates: BusinessProfileUpdate = { ...imageUpdates }
  if (uploadedQualifications) {
    postInsertUpdates.qualifications = parseQualifications({
      ...data,
      qualifications: uploadedQualifications,
    })
  }

  if (Object.keys(postInsertUpdates).length > 0) {
    const { data: updatedWithImages, error: imageUpdateError } = await supabase
      .from('business_profiles')
      .update(postInsertUpdates)
      .eq('id', inserted.id)
      .select()
      .single()

    if (imageUpdateError) {
      throw imageUpdateError
    }

    if (!updatedWithImages) {
      throw new Error('Asset upload succeeded but the profile row was not returned.')
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

  const user = await getCurrentUser()
  if (!user) {
    throw new Error('You must be logged in to update a business profile.')
  }

  if (data.logo || data.coverBanner || data.galleryImages.length > 0) {
    Object.assign(payload, await uploadPendingProfileImages(user.id, id, data))
  }

  const uploadedQualifications = await uploadPendingQualificationDocuments(user.id, id, data)
  if (uploadedQualifications) {
    payload.qualifications = parseQualifications({
      ...data,
      qualifications: uploadedQualifications,
    })
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

  await syncBusinessProfileDocuments(user.id, id, data)

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
    .select('*, business_profile_documents(*)')
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
