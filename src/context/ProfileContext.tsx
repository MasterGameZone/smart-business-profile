import { createContext, useContext, useState } from 'react'
import type { JsonObject, SocialLinks } from '../types/businessProfile'

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

export type SocialLinkKey = 'facebook' | 'instagram' | 'linkedin' | 'youtube' | 'x'

export type SocialLinksForm = Record<SocialLinkKey, string>

export const workingDays: Array<{ key: WorkingDayKey; label: string }> = [
  { key: 'monday', label: 'Monday' },
  { key: 'tuesday', label: 'Tuesday' },
  { key: 'wednesday', label: 'Wednesday' },
  { key: 'thursday', label: 'Thursday' },
  { key: 'friday', label: 'Friday' },
  { key: 'saturday', label: 'Saturday' },
  { key: 'sunday', label: 'Sunday' },
]

export const socialLinkFields: Array<{ key: SocialLinkKey; label: string; placeholder: string }> = [
  { key: 'facebook', label: 'Facebook', placeholder: 'https://facebook.com/yourbusiness' },
  { key: 'instagram', label: 'Instagram', placeholder: 'https://instagram.com/yourbusiness' },
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
    facebook: '',
    instagram: '',
    linkedin: '',
    youtube: '',
    x: '',
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
  const normalized = createDefaultSocialLinks()

  if (!value) return normalized

  for (const { key } of socialLinkFields) {
    normalized[key] = value[key] || ''
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

export interface ProfileData {
  id: string | null
  slug: string | null
  ownerId: string | null
  businessName: string
  ownerName: string
  businessCategory: string
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
}

function createDefaultProfileData(): ProfileData {
  return {
    id: null,
    slug: null,
    ownerId: null,
    businessName: '',
    ownerName: '',
    businessCategory: '',
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
  }
}

interface ProfileContextValue {
  profileData: ProfileData
  setProfileData: (data: ProfileData) => void
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
