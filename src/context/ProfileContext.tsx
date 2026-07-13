import { createContext, useContext, useState, type Dispatch, type SetStateAction } from 'react'
import type {
  BusinessProfileDocumentRow,
  BusinessProfileFaqValue,
  BusinessProfileProductValue,
  BusinessProfileQualificationValue,
  JsonObject,
  SocialLinks,
} from '../types/businessProfile'

export type WorkingDayKey =
  | 'monday'
  | 'tuesday'
  | 'wednesday'
  | 'thursday'
  | 'friday'
  | 'saturday'
  | 'sunday'

export interface WorkingHoursDay {
  open: string
  close: string
  closed: boolean
}

export type WorkingHoursForm = Record<WorkingDayKey, WorkingHoursDay>

export type SocialLinksForm = Record<string, string>

export interface ProfileFaqItem {
  id: string
  question: string
  answer: string
}

export interface ProfileProductItem {
  id: string
  name: string
  description: string
  price: string
  imageFile: File | null
  imageUrl: string | null
}

export interface ProfileQualificationItem {
  id: string
  title: string
  issuingOrganization: string
  year: string
  description: string
  documentFile: File | null
  documentFileName: string
  documentFilePath: string
  documentMimeType: string
}

let profileItemSequence = 0

function createProfileItemId(prefix: string): string {
  profileItemSequence += 1
  return `${prefix}-${profileItemSequence}`
}

export const workingDays: Array<{ key: WorkingDayKey; label: string }> = [
  { key: 'monday', label: 'Monday' },
  { key: 'tuesday', label: 'Tuesday' },
  { key: 'wednesday', label: 'Wednesday' },
  { key: 'thursday', label: 'Thursday' },
  { key: 'friday', label: 'Friday' },
  { key: 'saturday', label: 'Saturday' },
  { key: 'sunday', label: 'Sunday' },
]

export const socialLinkFields: Array<{ key: string; label: string; placeholder: string }> = [
  { key: 'instagram', label: 'Instagram', placeholder: 'https://instagram.com/yourbusiness' },
  { key: 'facebook', label: 'Facebook', placeholder: 'https://facebook.com/yourbusiness' },
  { key: 'linkedin', label: 'LinkedIn', placeholder: 'https://linkedin.com/company/yourbusiness' },
  { key: 'youtube', label: 'YouTube', placeholder: 'https://youtube.com/@yourbusiness' },
  { key: 'x', label: 'X / Twitter', placeholder: 'https://x.com/yourbusiness' },
]

export function createDefaultWorkingHours(): WorkingHoursForm {
  return {
    monday: { open: '', close: '', closed: false },
    tuesday: { open: '', close: '', closed: false },
    wednesday: { open: '', close: '', closed: false },
    thursday: { open: '', close: '', closed: false },
    friday: { open: '', close: '', closed: false },
    saturday: { open: '', close: '', closed: false },
    sunday: { open: '', close: '', closed: false },
  }
}

export function createDefaultSocialLinks(): SocialLinksForm {
  return {
    instagram: '',
    facebook: '',
  }
}

function isWorkingHoursDay(value: unknown): value is Partial<WorkingHoursDay> {
  return Boolean(value) && typeof value === 'object'
}

export function normalizeWorkingHours(value: JsonObject | null): WorkingHoursForm {
  const normalized = createDefaultWorkingHours()

  if (!value) return normalized

  for (const { key } of workingDays) {
    const day = value[key]
    if (!isWorkingHoursDay(day)) continue

    normalized[key] = {
      open: typeof day.open === 'string' ? day.open : '',
      close: typeof day.close === 'string' ? day.close : '',
      closed: typeof day.closed === 'boolean' ? day.closed : false,
    }
  }

  return normalized
}

export function normalizeSocialLinks(value: SocialLinks | null): SocialLinksForm {
  const normalized: SocialLinksForm = createDefaultSocialLinks()

  if (!value) return normalized

  for (const [key, entryValue] of Object.entries(value)) {
    const trimmedKey = key.trim()
    if (!trimmedKey || typeof entryValue !== 'string') continue

    normalized[trimmedKey] = entryValue
  }

  return normalized
}

export function formatServicesForForm(value: unknown[] | null): string {
  if (!Array.isArray(value)) return ''

  return value
    .filter((item): item is string => typeof item === 'string')
    .join('\n')
}

export function formatKeywordsForForm(value: string[] | null): string {
  if (!Array.isArray(value)) return ''
  return value.join(', ')
}

export function normalizeStringArray(value: string[] | null | undefined): string[] {
  if (!Array.isArray(value)) return []

  const seen = new Set<string>()
  const normalized: string[] = []

  value.forEach((item) => {
    if (typeof item !== 'string') return

    const trimmed = item.trim()
    const key = trimmed.toLowerCase()
    if (!trimmed || seen.has(key)) return

    seen.add(key)
    normalized.push(trimmed)
  })

  return normalized
}

export function createProfileFaqItem(question = '', answer = ''): ProfileFaqItem {
  return {
    id: createProfileItemId('faq'),
    question,
    answer,
  }
}

export function normalizeFaqItems(value: BusinessProfileFaqValue[] | null | undefined): ProfileFaqItem[] {
  if (!Array.isArray(value)) return []

  return value
    .filter((item): item is BusinessProfileFaqValue => Boolean(item) && typeof item === 'object')
    .map((item) =>
      createProfileFaqItem(
        typeof item.question === 'string' ? item.question : '',
        typeof item.answer === 'string' ? item.answer : ''
      )
    )
    .filter((item) => item.question.trim() || item.answer.trim())
}

export function createProfileProductItem(
  name = '',
  description = '',
  price = '',
  imageUrl: string | null = null
): ProfileProductItem {
  return {
    id: createProfileItemId('product'),
    name,
    description,
    price,
    imageFile: null,
    imageUrl,
  }
}

export function normalizeProductItems(
  value: BusinessProfileProductValue[] | null | undefined
): ProfileProductItem[] {
  if (!Array.isArray(value)) return [createProfileProductItem()]

  const normalized = value
    .filter((item): item is BusinessProfileProductValue => Boolean(item) && typeof item === 'object')
    .map((item) =>
      createProfileProductItem(
        typeof item.name === 'string' ? item.name : '',
        typeof item.description === 'string' ? item.description : '',
        typeof item.price === 'string' ? item.price : '',
        typeof item.imageUrl === 'string' ? item.imageUrl : null
      )
    )
    .filter(
      (item) =>
        item.name.trim() ||
        item.description.trim() ||
        item.price.trim() ||
        item.imageUrl
    )

  return normalized.length > 0 ? normalized : [createProfileProductItem()]
}

export function createProfileQualificationItem(
  title = '',
  issuingOrganization = '',
  year = '',
  description = '',
  documentFileName = '',
  documentFilePath = '',
  documentMimeType = ''
): ProfileQualificationItem {
  return {
    id: createProfileItemId('qualification'),
    title,
    issuingOrganization,
    year,
    description,
    documentFile: null,
    documentFileName,
    documentFilePath,
    documentMimeType,
  }
}

export function normalizeQualificationItems(
  value: BusinessProfileQualificationValue[] | null | undefined
): ProfileQualificationItem[] {
  if (!Array.isArray(value)) return []

  return value
    .filter((item): item is BusinessProfileQualificationValue => Boolean(item) && typeof item === 'object')
    .map((item) =>
      createProfileQualificationItem(
        typeof item.title === 'string' ? item.title : '',
        typeof item.issuingOrganization === 'string' ? item.issuingOrganization : '',
        typeof item.year === 'number' && Number.isFinite(item.year) ? String(item.year) : '',
        typeof item.description === 'string' ? item.description : '',
        typeof item.documentFileName === 'string' ? item.documentFileName : '',
        typeof item.documentFilePath === 'string' ? item.documentFilePath : '',
        typeof item.documentMimeType === 'string' ? item.documentMimeType : ''
      )
    )
    .filter(
      (item) =>
        item.title.trim() ||
        item.issuingOrganization.trim() ||
        item.year.trim() ||
        item.description.trim() ||
        item.documentFileName.trim() ||
        item.documentFilePath.trim()
    )
}

export function normalizeBusinessProfileDocuments(
  value: BusinessProfileDocumentRow[] | null | undefined
): BusinessProfileDocumentRow[] {
  if (!Array.isArray(value)) return []

  return value.filter(
    (item): item is BusinessProfileDocumentRow =>
      Boolean(item) &&
      typeof item.id === 'string' &&
      typeof item.business_profile_id === 'string' &&
      typeof item.owner_id === 'string' &&
      typeof item.file_name === 'string' &&
      typeof item.file_path === 'string' &&
      typeof item.mime_type === 'string' &&
      typeof item.created_at === 'string'
  )
}

export interface ProfileData {
  id: string | null
  slug: string | null
  ownerId: string | null
  businessName: string
  ownerName: string
  businessCategory: string
  businessSubcategories: string[]
  establishedYear: string
  yearsOfExperience: string
  highlights: string[]
  faqs: ProfileFaqItem[]
  productsMenuPackages: ProfileProductItem[]
  qualifications: ProfileQualificationItem[]
  phoneNumber: string
  whatsappNumber: string
  email: string
  website: string
  address: string
  aboutBusiness: string
  tagline: string
  servicesText: string
  workingHours: WorkingHoursForm
  googleMapsUrl: string
  socialLinks: SocialLinksForm
  keywordsText: string
  isPublic: boolean
  logo: File | null
  existingLogoUrl: string | null
  coverBanner: File | null
  existingCoverBannerUrl: string | null
  galleryImages: File[]
  existingGalleryImageUrls: string[]
  documentName: string
  documentFiles: File[]
  existingDocuments: BusinessProfileDocumentRow[]
}

export const CREATE_PROFILE_DRAFT_STORAGE_VERSION = 1
export const CREATE_PROFILE_DRAFT_STORAGE_PREFIX = 'smart-business-profile:create-profile-draft'

export function getCreateProfileDraftStorageKey(userId: string): string {
  return `${CREATE_PROFILE_DRAFT_STORAGE_PREFIX}:v${CREATE_PROFILE_DRAFT_STORAGE_VERSION}:${userId}:new`
}

export function removeCreateProfileDraft(userId: string | null | undefined): void {
  if (!userId) return

  try {
    window.localStorage.removeItem(getCreateProfileDraftStorageKey(userId))
  } catch {
    // Draft cleanup is best-effort when localStorage is unavailable.
  }
}

function createDefaultProfileData(): ProfileData {
  return {
    id: null,
    slug: null,
    ownerId: null,
    businessName: '',
    ownerName: '',
    businessCategory: '',
    businessSubcategories: [],
    establishedYear: '',
    yearsOfExperience: '',
    highlights: [],
    faqs: [],
    productsMenuPackages: [createProfileProductItem()],
    qualifications: [],
    phoneNumber: '',
    whatsappNumber: '',
    email: '',
    website: '',
    address: '',
    aboutBusiness: '',
    tagline: '',
    servicesText: '',
    workingHours: createDefaultWorkingHours(),
    googleMapsUrl: '',
    socialLinks: createDefaultSocialLinks(),
    keywordsText: '',
    isPublic: true,
    logo: null,
    existingLogoUrl: null,
    coverBanner: null,
    existingCoverBannerUrl: null,
    galleryImages: [],
    existingGalleryImageUrls: [],
    documentName: '',
    documentFiles: [],
    existingDocuments: [],
  }
}

interface ProfileContextValue {
  profileData: ProfileData
  setProfileData: Dispatch<SetStateAction<ProfileData>>
  clearProfile: () => void
}

const ProfileContext = createContext<ProfileContextValue | null>(null)

export function ProfileProvider({ children }: { children: React.ReactNode }) {
  const [profileData, setProfileData] = useState<ProfileData>(createDefaultProfileData)

  const clearProfile = () => {
    setProfileData(createDefaultProfileData())
  }

  return (
    <ProfileContext.Provider value={{ profileData, setProfileData, clearProfile }}>
      {children}
    </ProfileContext.Provider>
  )
}

export function useProfile(): ProfileContextValue {
  const ctx = useContext(ProfileContext)
  if (!ctx) {
    throw new Error('useProfile must be used within a ProfileProvider')
  }
  return ctx
}
