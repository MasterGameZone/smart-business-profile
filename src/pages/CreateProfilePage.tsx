import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  createDefaultSocialLinks,
  createProfileFaqItem,
  createProfileProductItem,
  createProfileQualificationItem,
  normalizeQualificationItems,
  useProfile,
  workingDays,
  type ProfileFaqItem,
  type ProfileProductItem,
  type ProfileQualificationItem,
  type WorkingDayKey,
} from '../context/ProfileContext.tsx'
import { useAuth } from '../context/AuthContext.tsx'
import { updateBusinessProfile } from '../lib/businessProfileService.ts'
import { validateDocumentFile, validateImageFile } from '../lib/storageService.ts'
import { usePageMeta } from '../hooks/usePageMeta.ts'
import { ToastContainer, type ToastItem, type ToastType } from '../components/Toast.tsx'
import AppHeader from '../components/AppHeader.tsx'
import {
  BUSINESS_CATEGORY_OPTIONS,
  getSubcategoriesForCategory,
} from '../constants/businessCategories.ts'

interface FormErrors {
  businessName?: string
  ownerName?: string
  businessCategory?: string
  businessSubcategories?: string
  establishedYear?: string
  yearsOfExperience?: string
  faqs?: string
  productsMenuPackages?: string
  qualifications?: string
  documents?: string
  documentName?: string
  phoneNumber?: string
  whatsappNumber?: string
  email?: string
  address?: string
  aboutBusiness?: string
  tagline?: string
  workingHours?: string
  googleMapsUrl?: string
  facebook?: string
  instagram?: string
  linkedin?: string
  youtube?: string
  x?: string
  keywordsText?: string
  logo?: string
  coverBanner?: string
  galleryImages?: string
}

const MAX_GALLERY_IMAGES = 6
const MAX_SUBCATEGORIES = 8
const MAX_FAQS = 5
const MAX_PRODUCTS_MENU_PACKAGES = 20
const ABOUT_BUSINESS_MAX_LENGTH = 600
const PRODUCT_ITEM_NAME_MAX_LENGTH = 30
const PRODUCT_DESCRIPTION_MAX_LENGTH = 120
const PRODUCT_PRICE_MAX_LENGTH = 30
const KEYWORDS_TEXT_MAX_LENGTH = 300
const FAQ_QUESTION_MAX_LENGTH = 100
const FAQ_ANSWER_MAX_LENGTH = 300
const MAX_SOCIAL_LINKS = 4
const MAX_QUALIFICATIONS = 10
const QUALIFICATION_TITLE_MAX_LENGTH = 60
const QUALIFICATION_ISSUING_ORGANIZATION_MAX_LENGTH = 60
const QUALIFICATION_DESCRIPTION_MAX_LENGTH = 200
const DOCUMENT_NAME_MAX_LENGTH = 60
const BUSINESS_NAME_MAX_LENGTH = 40
const OWNER_NAME_MAX_LENGTH = 30
const TAGLINE_MAX_LENGTH = 80
const BUSINESS_EXPERIENCE_MAX_LENGTH = 25
const INDIA_COUNTRY_CODE = '+91'
const INDIAN_MOBILE_NUMBER_LENGTH = 10
const imageAccept = 'image/jpeg,image/png,image/webp'
const documentAccept = 'application/pdf,image/jpeg,image/png,image/webp'
const FORM_STEPS = [
  'Basic Business Details',
  'Contact & Location Details',
  'Business Overview & Offerings',
  'Branding & Business Media',
  'Certificates & Documents',
] as const
const CREATE_PROFILE_STEP_STORAGE_PREFIX = 'smart-business-profile:create-profile-step'

function getCreateProfileStepStorageKey(profileId: string | null | undefined): string {
  return `${CREATE_PROFILE_STEP_STORAGE_PREFIX}:${profileId ?? 'new'}`
}

function readCreateProfileStepIndex(storageKey: string): number {
  try {
    const savedStep = window.sessionStorage.getItem(storageKey)
    const stepNumber = Number(savedStep)

    if (Number.isInteger(stepNumber) && stepNumber >= 1 && stepNumber <= FORM_STEPS.length) {
      return stepNumber - 1
    }
  } catch {
    // If sessionStorage is unavailable, safely fall back to the first step.
  }

  return 0
}

function writeCreateProfileStepIndex(storageKey: string, stepIndex: number): void {
  try {
    window.sessionStorage.setItem(storageKey, String(stepIndex + 1))
  } catch {
    // Step persistence is best-effort and should never block form navigation.
  }
}

function removeCreateProfileStepIndex(storageKey: string): void {
  try {
    window.sessionStorage.removeItem(storageKey)
  } catch {
    // Ignore unavailable sessionStorage during cleanup.
  }
}

function isValidOptionalUrl(value: string): boolean {
  const trimmed = value.trim()
  if (!trimmed) return true

  try {
    const url = new URL(trimmed)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

function normalizeIndianMobileInput(value: string): string {
  return value.replace(/\D/g, '').slice(0, INDIAN_MOBILE_NUMBER_LENGTH)
}

function toIndianMobileDisplayValue(value: string): string {
  const digits = value.replace(/\D/g, '')

  if (digits.startsWith('91') && digits.length >= 12) {
    return digits.slice(2, 12)
  }

  return digits.slice(0, INDIAN_MOBILE_NUMBER_LENGTH)
}

function isValidIndianMobileNumber(value: string): boolean {
  return /^[6-9]\d{9}$/.test(value)
}

function validateSelectedImage(file: File): string | null {
  const validation = validateImageFile(file)
  return validation.valid ? null : validation.error || 'Invalid image file.'
}

function validateSelectedDocument(file: File): string | null {
  const validation = validateDocumentFile(file)
  return validation.valid ? null : validation.error || 'Invalid document file.'
}

function normalizeSubcategoryValues(value: unknown): string[] {
  if (!Array.isArray(value)) return []

  const seen = new Set<string>()
  const subcategories: string[] = []

  for (const item of value) {
    if (typeof item !== 'string') continue

    const trimmed = item.trim()
    if (!trimmed || seen.has(trimmed)) continue

    seen.add(trimmed)
    subcategories.push(trimmed)
  }

  return subcategories
}

function isValidFourDigitYear(value: string): boolean {
  return /^\d{4}$/.test(value)
}

function getCurrentYear(): number {
  return new Date().getFullYear()
}

function hasWorkingHoursData(workingHours: Record<WorkingDayKey, { open: string; close: string; closed: boolean }>): boolean {
  return workingDays.some(({ key }) => {
    const day = workingHours[key]
    return day.closed || day.open.trim().length > 0 || day.close.trim().length > 0
  })
}

function hasIncompleteWorkingHours(workingHours: Record<WorkingDayKey, { open: string; close: string; closed: boolean }>): boolean {
  return workingDays.some(({ key }) => {
    const day = workingHours[key]
    if (day.closed) return false
    const hasOpen = day.open.trim().length > 0
    const hasClose = day.close.trim().length > 0
    return hasOpen !== hasClose
  })
}

function isBlankFaqItem(item: ProfileFaqItem): boolean {
  return !item.question.trim() && !item.answer.trim()
}

function isBlankProductItem(item: ProfileProductItem): boolean {
  return (
    !item.name.trim() &&
    !item.description.trim() &&
    !item.price.trim() &&
    !item.imageFile &&
    !item.imageUrl
  )
}

function isBlankQualificationItem(item: ProfileQualificationItem): boolean {
  return (
    !item.title.trim() &&
    !item.issuingOrganization.trim() &&
    !item.year.trim() &&
    !item.description.trim() &&
    !item.documentFile &&
    !item.documentFileName.trim() &&
    !item.documentFilePath.trim()
  )
}

function formatMimeTypeLabel(mimeType: string): string {
  switch (mimeType) {
    case 'application/pdf':
      return 'PDF'
    case 'image/jpeg':
      return 'JPG'
    case 'image/png':
      return 'PNG'
    case 'image/webp':
      return 'WebP'
    default:
      return mimeType || 'Document'
  }
}

interface SocialLinkRow {
  id: string
  platform: string
  url: string
}

let socialLinkRowSequence = 0

function createSocialLinkRow(platform = '', url = ''): SocialLinkRow {
  socialLinkRowSequence += 1

  return {
    id: `social-link-row-${socialLinkRowSequence}`,
    platform,
    url,
  }
}

function toSocialPlatformLabel(value: string): string {
  const trimmed = value.trim()
  if (!trimmed) return ''

  switch (trimmed.toLowerCase()) {
    case 'facebook':
      return 'Facebook'
    case 'instagram':
      return 'Instagram'
    case 'linkedin':
      return 'LinkedIn'
    case 'youtube':
      return 'YouTube'
    case 'x':
    case 'twitter':
    case 'x / twitter':
      return 'X / Twitter'
    default:
      return trimmed
  }
}

function getSocialLinkPlaceholder(platform: string): string {
  switch (platform.trim().toLowerCase()) {
    case 'facebook':
      return 'https://facebook.com/yourbusiness'
    case 'instagram':
      return 'https://instagram.com/yourbusiness'
    case 'linkedin':
      return 'https://linkedin.com/company/yourbusiness'
    case 'youtube':
      return 'https://youtube.com/@yourbusiness'
    case 'x':
    case 'twitter':
    case 'x / twitter':
      return 'https://x.com/yourbusiness'
    default:
      return 'https://example.com/yourbusiness'
  }
}

function createSocialLinkRows(links: Record<string, string>): SocialLinkRow[] {
  const entries = Object.entries(links).filter(
    ([, value]) => typeof value === 'string' && value.trim().length > 0
  )
  const defaultPlatforms = ['Instagram']
  const usedEntryIndexes = new Set<number>()

  const rows = defaultPlatforms.map((platform) => {
    const entryIndex = entries.findIndex(([key]) => toSocialPlatformLabel(key).toLowerCase() === platform.toLowerCase())

    if (entryIndex >= 0) {
      usedEntryIndexes.add(entryIndex)
      const [key, value] = entries[entryIndex]
      return createSocialLinkRow(toSocialPlatformLabel(key), value)
    }

    return createSocialLinkRow(platform, '')
  })

  entries.forEach(([key, value], index) => {
    if (usedEntryIndexes.has(index)) return

    rows.push(createSocialLinkRow(toSocialPlatformLabel(key), value))
  })

  return rows
}

function mapSocialLinkRowsToObject(rows: SocialLinkRow[]): Record<string, string> {
  return rows.reduce<Record<string, string>>((links, row) => {
    const platform = row.platform.trim()
    const url = row.url.trim()

    if (platform && url) {
      links[platform] = url
    }

    return links
  }, {})
}

function validateSocialLinkRows(rows: SocialLinkRow[]): Record<string, string> {
  const rowErrors: Record<string, string> = {}
  const usedPlatforms = new Map<string, string>()

  for (const row of rows) {
    const platform = row.platform.trim()
    const url = row.url.trim()

    if (!platform && !url) continue

    if (!platform && url) {
      rowErrors[row.id] = 'Platform name is required when a profile link is added.'
      continue
    }

    if (!url) continue

    if (!isValidOptionalUrl(url)) {
      rowErrors[row.id] = 'Enter a valid profile URL.'
      continue
    }

    const platformKey = platform.toLowerCase()
    const existingRowId = usedPlatforms.get(platformKey)
    if (existingRowId) {
      rowErrors[row.id] = 'Platform names must be unique.'
      rowErrors[existingRowId] = 'Platform names must be unique.'
      continue
    }

    usedPlatforms.set(platformKey, row.id)
  }

  return rowErrors
}

function formatBusinessExperienceValue(establishedYear: string, yearsOfExperience: string): string {
  const parts: string[] = []

  if (establishedYear.trim()) {
    parts.push(`Established in ${establishedYear.trim()}`)
  }

  if (yearsOfExperience.trim()) {
    parts.push(`${yearsOfExperience.trim()} years experience`)
  }

  return parts.join(' / ')
}

function parseBusinessExperienceValue(value: string): {
  establishedYear: string
  yearsOfExperience: string
} {
  const trimmed = value.trim()
  const yearMatch = trimmed.match(/\b(\d{4})\b/)
  const yearsWithLabelMatch = trimmed.match(/\b(\d{1,3})\s*(?:years?|yrs?)\b/i)
  const slashYearsMatch = trimmed.match(/\/\s*(\d{1,3})\b/)
  const standaloneYearsMatch = trimmed.match(/^\d{1,3}$/)

  return {
    establishedYear: yearMatch?.[1] ?? '',
    yearsOfExperience: yearsWithLabelMatch?.[1] ?? slashYearsMatch?.[1] ?? standaloneYearsMatch?.[0] ?? '',
  }
}

interface FormSectionHeadingProps {
  id: string
  title: string
  description: string
  action?: React.ReactNode
  showAccent?: boolean
}

function FormSectionHeading({
  id,
  title,
  description,
  action,
  showAccent = true,
}: FormSectionHeadingProps) {
  return (
    <div className="mb-6 border-b border-slate-200/80 pb-4">
      {showAccent && (
        <span
          aria-hidden="true"
          className="block h-1 w-14 rounded-full bg-[linear-gradient(90deg,#0f172a_0%,#2563eb_58%,#38bdf8_100%)]"
        />
      )}
      <div className="mt-4 flex items-center justify-between gap-3">
        <h2 id={id} className="text-xl font-semibold tracking-tight text-slate-900 sm:text-[1.35rem]">
          {title}
        </h2>
        {action}
      </div>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">{description}</p>
    </div>
  )
}

interface FormSubsectionHeadingProps {
  id: string
  title: React.ReactNode
  description: string
  action?: React.ReactNode
}

function FormSubsectionHeading({ id, title, description, action }: FormSubsectionHeadingProps) {
  return (
    <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <h3 id={id} className="text-sm font-medium text-slate-700">
          {title}
        </h3>
        <p className="mt-2 text-xs leading-5 text-slate-500">{description}</p>
      </div>
      {action}
    </div>
  )
}

interface StepProgressIndicatorProps {
  currentStepIndex: number
  steps: readonly string[]
}

function StepProgressIndicator({ currentStepIndex, steps }: StepProgressIndicatorProps) {
  const progressPercentage = ((currentStepIndex + 1) / steps.length) * 100
  const circleSizes = ['h-1.5 w-1.5', 'h-2 w-2', 'h-2.5 w-2.5', 'h-2 w-2', 'h-1.5 w-1.5']

  return (
    <div className="mx-auto w-1/2 max-w-[360px] min-w-[190px] py-2">
      <div className="relative h-5">
        <div className="absolute left-0 right-0 top-1/2 h-px -translate-y-1/2 overflow-hidden rounded-full bg-slate-200/70">
          <div
            className="h-full rounded-full bg-[linear-gradient(135deg,#0f172a_0%,#1d4ed8_58%,#2563eb_100%)] transition-[width] duration-500 ease-out"
            style={{ width: `${progressPercentage}%` }}
          />
        </div>
        <div
          className="absolute inset-0 flex items-center justify-between"
          aria-label={`Profile form step ${currentStepIndex + 1} of ${steps.length}`}
        >
          {steps.map((step, index) => {
            const stateClass =
              index < currentStepIndex
                ? 'bg-blue-600'
                : index === currentStepIndex
                  ? 'bg-blue-500/60'
                  : 'bg-slate-300'

            return (
              <span
                key={step}
                aria-hidden="true"
                className={`${circleSizes[index] ?? 'h-1.5 w-1.5'} rounded-full ${stateClass} transition-colors duration-300`}
              />
            )
          })}
        </div>
      </div>
    </div>
  )
}

function CreateProfilePage() {
  const navigate = useNavigate()
  const { profileData, setProfileData, clearProfile } = useProfile()
  const { user, accountMode } = useAuth()

  usePageMeta({
    title: 'Create Business Profile | Smart Business Profile',
    description: 'Create a professional business profile with contact details, QR code, and public sharing link.',
  })

  const isEditMode = Boolean(profileData.id)
  const isForbidden =
    isEditMode && Boolean(profileData.ownerId) && profileData.ownerId !== user?.id
  const stepStorageKey = getCreateProfileStepStorageKey(profileData.id)

  const [errors, setErrors] = useState<FormErrors>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [logoFileName, setLogoFileName] = useState<string>(
    profileData.logo ? profileData.logo.name : ''
  )
  const [coverBannerFileName, setCoverBannerFileName] = useState<string>(
    profileData.coverBanner ? profileData.coverBanner.name : ''
  )
  const [socialLinkRows, setSocialLinkRows] = useState<SocialLinkRow[]>(() =>
    createSocialLinkRows(profileData.socialLinks)
  )
  const [socialLinkRowErrors, setSocialLinkRowErrors] = useState<Record<string, string>>({})
  const [currentStepIndex, setCurrentStepIndex] = useState(() =>
    readCreateProfileStepIndex(stepStorageKey)
  )
  const [businessExperienceValue, setBusinessExperienceValue] = useState(() =>
    formatBusinessExperienceValue(profileData.establishedYear, profileData.yearsOfExperience)
  )
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const [isSubcategoryDropdownOpen, setIsSubcategoryDropdownOpen] = useState(false)
  const logoInputRef = useRef<HTMLInputElement>(null)
  const coverBannerInputRef = useRef<HTMLInputElement>(null)
  const galleryInputRef = useRef<HTMLInputElement>(null)
  const documentInputRef = useRef<HTMLInputElement>(null)
  const subcategoryDropdownRef = useRef<HTMLDivElement>(null)
  const stepContentRef = useRef<HTMLDivElement>(null)
  const shouldScrollStepIntoViewRef = useRef(false)
  const previousProfileIdRef = useRef(profileData.id)

  const coverBannerPreviewUrl = useMemo(() => {
    if (profileData.coverBanner) return URL.createObjectURL(profileData.coverBanner)
    return profileData.existingCoverBannerUrl
  }, [profileData.coverBanner, profileData.existingCoverBannerUrl])

  const selectedGalleryPreviews = useMemo(
    () =>
      profileData.galleryImages.map((file, index) => ({
        key: `${file.name}-${file.lastModified}-${index}`,
        name: file.name,
        url: URL.createObjectURL(file),
      })),
    [profileData.galleryImages]
  )
  const productImagePreviews = useMemo(() => {
    const previews: Record<string, string> = {}

    profileData.productsMenuPackages.forEach((item) => {
      if (item.imageFile) {
        previews[item.id] = URL.createObjectURL(item.imageFile)
      } else if (item.imageUrl) {
        previews[item.id] = item.imageUrl
      }
    })

    return previews
  }, [profileData.productsMenuPackages])
  const availableSubcategories = useMemo(
    () => getSubcategoriesForCategory(profileData.businessCategory),
    [profileData.businessCategory]
  )
  const categoryOptions = useMemo(() => {
    if (
      profileData.businessCategory &&
      !BUSINESS_CATEGORY_OPTIONS.includes(profileData.businessCategory)
    ) {
      return [profileData.businessCategory, ...BUSINESS_CATEGORY_OPTIONS]
    }

    return BUSINESS_CATEGORY_OPTIONS
  }, [profileData.businessCategory])
  const selectedSubcategorySummary =
    profileData.businessSubcategories.length > 0
      ? `${profileData.businessSubcategories.length} subcategor${profileData.businessSubcategories.length === 1 ? 'y' : 'ies'} selected`
      : 'Select subcategories'
  const isFirstStep = currentStepIndex === 0
  const isLastStep = currentStepIndex === FORM_STEPS.length - 1

  useEffect(() => {
    setCurrentStepIndex(readCreateProfileStepIndex(stepStorageKey))
  }, [stepStorageKey])

  useEffect(() => {
    if (!shouldScrollStepIntoViewRef.current) return undefined

    shouldScrollStepIntoViewRef.current = false

    const animationFrame = window.requestAnimationFrame(() => {
      const stepContent = stepContentRef.current
      if (!stepContent) return

      const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      stepContent.scrollIntoView({
        behavior: prefersReducedMotion ? 'auto' : 'smooth',
        block: 'start',
      })
    })

    return () => window.cancelAnimationFrame(animationFrame)
  }, [currentStepIndex])

  useEffect(() => {
    if (previousProfileIdRef.current === profileData.id) return

    previousProfileIdRef.current = profileData.id
    setBusinessExperienceValue(
      formatBusinessExperienceValue(profileData.establishedYear, profileData.yearsOfExperience)
    )
  }, [profileData.establishedYear, profileData.id, profileData.yearsOfExperience])

  useEffect(() => {
    const normalizedPhoneNumber = toIndianMobileDisplayValue(profileData.phoneNumber)
    const normalizedWhatsappNumber = toIndianMobileDisplayValue(profileData.whatsappNumber)

    if (
      normalizedPhoneNumber === profileData.phoneNumber &&
      normalizedWhatsappNumber === profileData.whatsappNumber
    ) {
      return
    }

    setProfileData({
      ...profileData,
      phoneNumber: normalizedPhoneNumber,
      whatsappNumber: normalizedWhatsappNumber,
    })
  }, [profileData, setProfileData])

  useEffect(() => {
    return () => {
      if (profileData.coverBanner && coverBannerPreviewUrl) {
        URL.revokeObjectURL(coverBannerPreviewUrl)
      }
    }
  }, [coverBannerPreviewUrl, profileData.coverBanner])

  useEffect(() => {
    return () => {
      selectedGalleryPreviews.forEach((preview) => URL.revokeObjectURL(preview.url))
    }
  }, [selectedGalleryPreviews])

  useEffect(() => {
    return () => {
      profileData.productsMenuPackages.forEach((item) => {
        if (item.imageFile && productImagePreviews[item.id]) {
          URL.revokeObjectURL(productImagePreviews[item.id])
        }
      })
    }
  }, [productImagePreviews, profileData.productsMenuPackages])

  useEffect(() => {
    if (!isSubcategoryDropdownOpen) return undefined

    const handlePointerDown = (event: MouseEvent) => {
      if (!subcategoryDropdownRef.current?.contains(event.target as Node)) {
        setIsSubcategoryDropdownOpen(false)
      }
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsSubcategoryDropdownOpen(false)
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isSubcategoryDropdownOpen])

  const showToast = (message: string, type: ToastType = 'success') => {
    const id = Date.now()
    setToasts((prev) => [...prev, { id, message, type }])
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000)
  }

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ) => {
    const { name, value } = e.target
    if (name === 'businessCategory') {
      setProfileData({
        ...profileData,
        businessCategory: value,
        businessSubcategories: [],
      })
      setIsSubcategoryDropdownOpen(false)
      setErrors((prev) => ({
        ...prev,
        businessCategory: undefined,
        businessSubcategories: undefined,
      }))
      return
    }

    setProfileData({ ...profileData, [name]: value })
    if (errors[name as keyof FormErrors]) {
      setErrors((prev) => ({ ...prev, [name]: undefined }))
    }
  }

  const handleBusinessExperienceChange = (value: string) => {
    const parsed = parseBusinessExperienceValue(value)

    setBusinessExperienceValue(value)
    setProfileData({
      ...profileData,
      establishedYear: parsed.establishedYear,
      yearsOfExperience: parsed.yearsOfExperience,
    })

    if (errors.establishedYear || errors.yearsOfExperience) {
      setErrors((prev) => ({
        ...prev,
        establishedYear: undefined,
        yearsOfExperience: undefined,
      }))
    }
  }

  const handleIndianMobileChange = (
    field: 'phoneNumber' | 'whatsappNumber',
    value: string
  ) => {
    const normalizedValue = normalizeIndianMobileInput(value)

    setProfileData({
      ...profileData,
      [field]: normalizedValue,
    })

    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }))
    }
  }

  const handleSubcategoryToggle = (subcategory: string) => {
    const isSelected = profileData.businessSubcategories.includes(subcategory)

    if (isSelected) {
      setProfileData({
        ...profileData,
        businessSubcategories: profileData.businessSubcategories.filter((item) => item !== subcategory),
      })
      if (errors.businessSubcategories) {
        setErrors((prev) => ({ ...prev, businessSubcategories: undefined }))
      }
      return
    }

    if (profileData.businessSubcategories.length >= MAX_SUBCATEGORIES) {
      setErrors((prev) => ({
        ...prev,
        businessSubcategories: `Select up to ${MAX_SUBCATEGORIES} subcategories.`,
      }))
      return
    }

    setProfileData({
      ...profileData,
      businessSubcategories: [...profileData.businessSubcategories, subcategory],
    })
    if (errors.businessSubcategories) {
      setErrors((prev) => ({ ...prev, businessSubcategories: undefined }))
    }
  }

  const handleRemoveSubcategory = (subcategory: string) => {
    setProfileData({
      ...profileData,
      businessSubcategories: profileData.businessSubcategories.filter((item) => item !== subcategory),
    })
    if (errors.businessSubcategories) {
      setErrors((prev) => ({ ...prev, businessSubcategories: undefined }))
    }
  }

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null

    if (!file) {
      setProfileData({ ...profileData, logo: null })
      setLogoFileName('')
      setErrors((prev) => ({ ...prev, logo: undefined }))
      return
    }

    const validationError = validateSelectedImage(file)
    if (validationError) {
      setProfileData({ ...profileData, logo: null })
      setLogoFileName('')
      setErrors((prev) => ({ ...prev, logo: validationError }))
      if (logoInputRef.current) {
        logoInputRef.current.value = ''
      }
      return
    }

    setProfileData({ ...profileData, logo: file })
    setLogoFileName(file ? file.name : '')
    setErrors((prev) => ({ ...prev, logo: undefined }))
  }

  const handleCoverBannerChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null

    if (!file) {
      setProfileData({ ...profileData, coverBanner: null })
      setCoverBannerFileName('')
      setErrors((prev) => ({ ...prev, coverBanner: undefined }))
      return
    }

    const validationError = validateSelectedImage(file)
    if (validationError) {
      setProfileData({ ...profileData, coverBanner: null })
      setCoverBannerFileName('')
      setErrors((prev) => ({ ...prev, coverBanner: validationError }))
      if (coverBannerInputRef.current) {
        coverBannerInputRef.current.value = ''
      }
      return
    }

    setProfileData({ ...profileData, coverBanner: file })
    setCoverBannerFileName(file.name)
    setErrors((prev) => ({ ...prev, coverBanner: undefined }))
  }

  const handleClearCoverBanner = () => {
    setProfileData({
      ...profileData,
      coverBanner: null,
      existingCoverBannerUrl: null,
    })
    setCoverBannerFileName('')
    setErrors((prev) => ({ ...prev, coverBanner: undefined }))
    if (coverBannerInputRef.current) {
      coverBannerInputRef.current.value = ''
    }
  }

  const handleGalleryImagesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files ?? [])
    if (selectedFiles.length === 0) return

    const remainingSlots =
      MAX_GALLERY_IMAGES - profileData.existingGalleryImageUrls.length - profileData.galleryImages.length

    if (remainingSlots <= 0) {
      setErrors((prev) => ({ ...prev, galleryImages: `You can upload up to ${MAX_GALLERY_IMAGES} gallery images.` }))
      if (galleryInputRef.current) {
        galleryInputRef.current.value = ''
      }
      return
    }

    const validFiles: File[] = []

    for (const file of selectedFiles) {
      const validationError = validateSelectedImage(file)
      if (validationError) {
        setErrors((prev) => ({ ...prev, galleryImages: validationError }))
        if (galleryInputRef.current) {
          galleryInputRef.current.value = ''
        }
        return
      }

      validFiles.push(file)
    }

    const allowedFiles = validFiles.slice(0, remainingSlots)
    const limitMessage =
      validFiles.length > remainingSlots
        ? `Only ${remainingSlots} more gallery image${remainingSlots === 1 ? '' : 's'} can be added. The extra files were not selected.`
        : undefined

    setProfileData({
      ...profileData,
      galleryImages: [...profileData.galleryImages, ...allowedFiles],
    })
    setErrors((prev) => ({ ...prev, galleryImages: limitMessage }))

    if (galleryInputRef.current) {
      galleryInputRef.current.value = ''
    }
  }

  const handleRemoveSelectedGalleryImage = (index: number) => {
    setProfileData({
      ...profileData,
      galleryImages: profileData.galleryImages.filter((_, imageIndex) => imageIndex !== index),
    })
    setErrors((prev) => ({ ...prev, galleryImages: undefined }))
  }

  const handleRemoveExistingGalleryImage = (url: string) => {
    setProfileData({
      ...profileData,
      existingGalleryImageUrls: profileData.existingGalleryImageUrls.filter((imageUrl) => imageUrl !== url),
    })
    setErrors((prev) => ({ ...prev, galleryImages: undefined }))
  }

  const updateSocialLinksFromRows = (rows: SocialLinkRow[]) => {
    setSocialLinkRows(rows)
    setProfileData({
      ...profileData,
      socialLinks: mapSocialLinkRowsToObject(rows),
    })
  }

  const handleSocialLinkChange = (
    rowId: string,
    field: 'platform' | 'url',
    value: string
  ) => {
    const nextRows = socialLinkRows.map((row) =>
      row.id === rowId ? { ...row, [field]: value } : row
    )

    updateSocialLinksFromRows(nextRows)
    if (Object.keys(socialLinkRowErrors).length > 0) {
      setSocialLinkRowErrors({})
    }
  }

  const handleAddSocialLinkRow = () => {
    if (socialLinkRows.length >= MAX_SOCIAL_LINKS) {
      return
    }

    updateSocialLinksFromRows([...socialLinkRows, createSocialLinkRow('', '')])
    if (Object.keys(socialLinkRowErrors).length > 0) {
      setSocialLinkRowErrors({})
    }
  }

  const handleRemoveSocialLinkRow = (rowId: string) => {
    updateSocialLinksFromRows(socialLinkRows.filter((row) => row.id !== rowId))
    if (Object.keys(socialLinkRowErrors).length > 0) {
      setSocialLinkRowErrors({})
    }
  }

  const handleWorkingHoursChange = (
    dayKey: WorkingDayKey,
    field: 'open' | 'close',
    value: string
  ) => {
    setProfileData({
      ...profileData,
      workingHours: {
        ...profileData.workingHours,
        [dayKey]: {
          ...profileData.workingHours[dayKey],
          [field]: value,
        },
      },
    })
    if (errors.workingHours) {
      setErrors((prev) => ({ ...prev, workingHours: undefined }))
    }
  }

  const handleClosedChange = (dayKey: WorkingDayKey, checked: boolean) => {
    setProfileData({
      ...profileData,
      workingHours: {
        ...profileData.workingHours,
        [dayKey]: {
          ...profileData.workingHours[dayKey],
          open: checked ? '' : profileData.workingHours[dayKey].open,
          close: checked ? '' : profileData.workingHours[dayKey].close,
          closed: checked,
        },
      },
    })
    if (errors.workingHours) {
      setErrors((prev) => ({ ...prev, workingHours: undefined }))
    }
  }

  const updateFaqs = (faqs: ProfileFaqItem[]) => {
    setProfileData({
      ...profileData,
      faqs,
    })
    if (errors.faqs) {
      setErrors((prev) => ({ ...prev, faqs: undefined }))
    }
  }

  const updateProductsMenuPackages = (productsMenuPackages: ProfileProductItem[]) => {
    setProfileData({
      ...profileData,
      productsMenuPackages,
    })
    if (errors.productsMenuPackages) {
      setErrors((prev) => ({ ...prev, productsMenuPackages: undefined }))
    }
  }

  const updateQualifications = (qualifications: ProfileQualificationItem[]) => {
    setProfileData({
      ...profileData,
      qualifications,
    })
    if (errors.qualifications) {
      setErrors((prev) => ({ ...prev, qualifications: undefined }))
    }
  }

  const handleFaqChange = (
    faqId: string,
    field: 'question' | 'answer',
    value: string
  ) => {
    updateFaqs(
      profileData.faqs.map((item) => (item.id === faqId ? { ...item, [field]: value } : item))
    )
  }

  const handleAddFaq = () => {
    if (profileData.faqs.length >= MAX_FAQS) return

    updateFaqs([...profileData.faqs, createProfileFaqItem()])
  }

  const handleRemoveFaq = (faqId: string) => {
    updateFaqs(profileData.faqs.filter((item) => item.id !== faqId))
  }

  const handleProductChange = (
    itemId: string,
    field: 'name' | 'description' | 'price',
    value: string
  ) => {
    updateProductsMenuPackages(
      profileData.productsMenuPackages.map((item) =>
        item.id === itemId ? { ...item, [field]: value } : item
      )
    )
  }

  const handleProductImageChange = (
    itemId: string,
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0] || null
    e.target.value = ''

    if (!file) return

    const validationError = validateSelectedImage(file)
    if (validationError) {
      setErrors((prev) => ({ ...prev, productsMenuPackages: validationError }))
      return
    }

    updateProductsMenuPackages(
      profileData.productsMenuPackages.map((item) =>
        item.id === itemId ? { ...item, imageFile: file } : item
      )
    )
  }

  const handleRemoveProductImage = (itemId: string) => {
    updateProductsMenuPackages(
      profileData.productsMenuPackages.map((item) =>
        item.id === itemId ? { ...item, imageFile: null, imageUrl: null } : item
      )
    )
  }

  const handleAddProduct = () => {
    if (profileData.productsMenuPackages.length >= MAX_PRODUCTS_MENU_PACKAGES) {
      return
    }

    updateProductsMenuPackages([...profileData.productsMenuPackages, createProfileProductItem()])
  }

  const handleRemoveProduct = (itemId: string) => {
    updateProductsMenuPackages(profileData.productsMenuPackages.filter((item) => item.id !== itemId))
  }

  const handleQualificationChange = (
    itemId: string,
    field: 'title' | 'issuingOrganization' | 'year' | 'description',
    value: string
  ) => {
    updateQualifications(
      profileData.qualifications.map((item) =>
        item.id === itemId ? { ...item, [field]: value } : item
      )
    )
  }

  const handleQualificationDocumentChange = (
    itemId: string,
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0]
    if (!file) return

    const validationError = validateSelectedDocument(file)
    if (validationError) {
      setErrors((prev) => ({ ...prev, qualifications: validationError }))
      e.target.value = ''
      return
    }

    updateQualifications(
      profileData.qualifications.map((item) =>
        item.id === itemId
          ? {
              ...item,
              documentFile: file,
              documentFileName: file.name,
              documentMimeType: file.type,
            }
          : item
      )
    )
    e.target.value = ''
  }

  const handleRemoveQualificationDocument = (itemId: string) => {
    updateQualifications(
      profileData.qualifications.map((item) =>
        item.id === itemId
          ? {
              ...item,
              documentFile: null,
              documentFileName: '',
              documentFilePath: '',
              documentMimeType: '',
            }
          : item
      )
    )
  }

  const handleAddQualification = () => {
    if (profileData.qualifications.length >= MAX_QUALIFICATIONS) {
      return
    }

    updateQualifications([...profileData.qualifications, createProfileQualificationItem()])
  }

  const handleRemoveQualification = (itemId: string) => {
    updateQualifications(profileData.qualifications.filter((item) => item.id !== itemId))
  }

  const handleDocumentFilesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files ?? [])
    if (selectedFiles.length === 0) return

    const existingKeys = new Set(
      [
        ...profileData.existingDocuments.map((document) => document.file_name.toLowerCase()),
        ...profileData.documentFiles.map((file) => file.name.toLowerCase()),
      ]
    )
    const nextDocumentFiles = [...profileData.documentFiles]

    for (const file of selectedFiles) {
      const validationError = validateSelectedDocument(file)
      if (validationError) {
        setErrors((prev) => ({ ...prev, documents: validationError }))
        if (documentInputRef.current) {
          documentInputRef.current.value = ''
        }
        return
      }

      const key = file.name.toLowerCase()
      if (existingKeys.has(key)) {
        continue
      }

      existingKeys.add(key)
      nextDocumentFiles.push(file)
    }

    setProfileData({
      ...profileData,
      documentFiles: nextDocumentFiles,
    })
    setErrors((prev) => ({ ...prev, documents: undefined }))

    if (documentInputRef.current) {
      documentInputRef.current.value = ''
    }
  }

  const handleRemovePendingDocument = (index: number) => {
    setProfileData({
      ...profileData,
      documentFiles: profileData.documentFiles.filter((_, documentIndex) => documentIndex !== index),
    })
    if (errors.documents) {
      setErrors((prev) => ({ ...prev, documents: undefined }))
    }
  }

  const handleRemoveExistingDocument = (documentId: string) => {
    setProfileData({
      ...profileData,
      existingDocuments: profileData.existingDocuments.filter((document) => document.id !== documentId),
    })
    if (errors.documents) {
      setErrors((prev) => ({ ...prev, documents: undefined }))
    }
  }

  const validate = (): boolean => {
    const newErrors: FormErrors = {}
    const currentYear = getCurrentYear()

    if (!profileData.businessName.trim()) {
      newErrors.businessName = 'Business name is required.'
    } else if (profileData.businessName.length > BUSINESS_NAME_MAX_LENGTH) {
      newErrors.businessName = `Business name must be ${BUSINESS_NAME_MAX_LENGTH} characters or fewer.`
    }
    if (!profileData.ownerName.trim()) {
      newErrors.ownerName = 'Owner name is required.'
    } else if (profileData.ownerName.length > OWNER_NAME_MAX_LENGTH) {
      newErrors.ownerName = `Owner name must be ${OWNER_NAME_MAX_LENGTH} characters or fewer.`
    }
    if (!profileData.businessCategory) {
      newErrors.businessCategory = 'Please select a category.'
    }
    if (profileData.businessSubcategories.length > MAX_SUBCATEGORIES) {
      newErrors.businessSubcategories = `Select up to ${MAX_SUBCATEGORIES} subcategories.`
    }
    if (!profileData.phoneNumber.trim()) {
      newErrors.phoneNumber = 'Phone number is required.'
    } else if (!isValidIndianMobileNumber(profileData.phoneNumber)) {
      newErrors.phoneNumber = 'Enter a valid 10-digit Indian mobile number starting with 6, 7, 8, or 9.'
    }
    if (profileData.whatsappNumber.trim() && !isValidIndianMobileNumber(profileData.whatsappNumber)) {
      newErrors.whatsappNumber = 'Enter a valid 10-digit Indian mobile number starting with 6, 7, 8, or 9.'
    }
    if (!profileData.email.trim()) {
      newErrors.email = 'Email address is required.'
    }
    if (profileData.tagline.length > TAGLINE_MAX_LENGTH) {
      newErrors.tagline = `Tagline must be ${TAGLINE_MAX_LENGTH} characters or fewer.`
    }
    if (!businessExperienceValue.trim()) {
      newErrors.establishedYear = 'Established year or years of experience is required.'
    } else if (businessExperienceValue.length > BUSINESS_EXPERIENCE_MAX_LENGTH) {
      newErrors.establishedYear = `Established year or years of experience must be ${BUSINESS_EXPERIENCE_MAX_LENGTH} characters or fewer.`
    } else if (
      businessExperienceValue.trim() &&
      !profileData.establishedYear.trim() &&
      !profileData.yearsOfExperience.trim()
    ) {
      newErrors.establishedYear = 'Enter an established year, years of experience, or both.'
    }
    if (profileData.establishedYear.trim()) {
      if (!isValidFourDigitYear(profileData.establishedYear.trim())) {
        newErrors.establishedYear = 'Enter a valid four-digit year.'
      } else if (Number(profileData.establishedYear) > currentYear) {
        newErrors.establishedYear = 'Established year cannot be in the future.'
      }
    }
    if (profileData.yearsOfExperience.trim()) {
      const yearsOfExperience = Number(profileData.yearsOfExperience)
      if (!Number.isInteger(yearsOfExperience) || yearsOfExperience < 0) {
        newErrors.yearsOfExperience = 'Years of experience must be 0 or more.'
      }
    }
    if (
      profileData.faqs.some(
        (item) => !isBlankFaqItem(item) && (!item.question.trim() || !item.answer.trim())
      )
    ) {
      newErrors.faqs = 'Complete both the question and answer, or remove the FAQ item.'
    } else if (profileData.faqs.length > MAX_FAQS) {
      newErrors.faqs = `Add up to ${MAX_FAQS} FAQs only.`
    } else if (
      profileData.faqs.some(
        (item) =>
          item.question.length > FAQ_QUESTION_MAX_LENGTH ||
          item.answer.length > FAQ_ANSWER_MAX_LENGTH
      )
    ) {
      newErrors.faqs = `Keep FAQ questions within ${FAQ_QUESTION_MAX_LENGTH} characters and answers within ${FAQ_ANSWER_MAX_LENGTH} characters.`
    }
    if (
      profileData.productsMenuPackages.some(
        (item) =>
          !isBlankProductItem(item) &&
          (!item.name.trim() || !item.price.trim())
      )
    ) {
      newErrors.productsMenuPackages =
        'Complete the item name and price, or remove the product/menu/package item.'
    } else if (profileData.productsMenuPackages.length > MAX_PRODUCTS_MENU_PACKAGES) {
      newErrors.productsMenuPackages = `Add up to ${MAX_PRODUCTS_MENU_PACKAGES} items only.`
    } else if (
      profileData.productsMenuPackages.some(
        (item) =>
          item.name.length > PRODUCT_ITEM_NAME_MAX_LENGTH ||
          item.description.length > PRODUCT_DESCRIPTION_MAX_LENGTH ||
          item.price.length > PRODUCT_PRICE_MAX_LENGTH
      )
    ) {
      newErrors.productsMenuPackages =
        `Keep item name within ${PRODUCT_ITEM_NAME_MAX_LENGTH} characters, description within ${PRODUCT_DESCRIPTION_MAX_LENGTH} characters, and price within ${PRODUCT_PRICE_MAX_LENGTH} characters.`
    }
    if (
      profileData.qualifications.some((item) => {
        if (isBlankQualificationItem(item)) return false
        if (!item.title.trim()) return true
        if (!item.year.trim()) return false
        if (!isValidFourDigitYear(item.year.trim())) return true
        return Number(item.year) > currentYear
      })
    ) {
      newErrors.qualifications =
        'Each qualification needs a title. Optional years must be valid four-digit years that are not in the future.'
    } else if (profileData.qualifications.length > MAX_QUALIFICATIONS) {
      newErrors.qualifications = `Add up to ${MAX_QUALIFICATIONS} credentials only.`
    } else if (
      profileData.qualifications.some(
        (item) =>
          item.title.length > QUALIFICATION_TITLE_MAX_LENGTH ||
          item.issuingOrganization.length > QUALIFICATION_ISSUING_ORGANIZATION_MAX_LENGTH ||
          item.description.length > QUALIFICATION_DESCRIPTION_MAX_LENGTH
      )
    ) {
      newErrors.qualifications =
        `Keep qualification name within ${QUALIFICATION_TITLE_MAX_LENGTH} characters, issuing organization within ${QUALIFICATION_ISSUING_ORGANIZATION_MAX_LENGTH} characters, and description within ${QUALIFICATION_DESCRIPTION_MAX_LENGTH} characters.`
    }
    if (profileData.documentName.length > DOCUMENT_NAME_MAX_LENGTH) {
      newErrors.documentName = `Document name must be ${DOCUMENT_NAME_MAX_LENGTH} characters or fewer.`
    }
    if (!profileData.address.trim()) {
      newErrors.address = 'Address is required.'
    }
    if (!profileData.googleMapsUrl.trim()) {
      newErrors.googleMapsUrl = 'Google Maps link is required.'
    } else if (!isValidOptionalUrl(profileData.googleMapsUrl)) {
      newErrors.googleMapsUrl = 'Enter a valid Google Maps URL.'
    }
    if (!profileData.aboutBusiness.trim()) {
      newErrors.aboutBusiness = 'About business is required.'
    } else if (profileData.aboutBusiness.length > ABOUT_BUSINESS_MAX_LENGTH) {
      newErrors.aboutBusiness = `About business must be ${ABOUT_BUSINESS_MAX_LENGTH} characters or fewer.`
    }
    if (profileData.keywordsText.length > KEYWORDS_TEXT_MAX_LENGTH) {
      newErrors.keywordsText = `Business keywords / tags must be ${KEYWORDS_TEXT_MAX_LENGTH} characters or fewer.`
    }
    if (!hasWorkingHoursData(profileData.workingHours)) {
      newErrors.workingHours = 'Working hours are required.'
    } else if (hasIncompleteWorkingHours(profileData.workingHours)) {
      newErrors.workingHours = 'Provide both open and close times, or mark the day closed.'
    }
    if (profileData.existingGalleryImageUrls.length + profileData.galleryImages.length === 0) {
      newErrors.galleryImages = 'Business gallery requires at least one image.'
    }

    const nextSocialLinkRowErrors = validateSocialLinkRows(socialLinkRows)

    setSocialLinkRowErrors(nextSocialLinkRowErrors)
    setErrors(newErrors)

    return Object.keys(newErrors).length === 0 && Object.keys(nextSocialLinkRowErrors).length === 0
  }

  const focusFirstErrorField = () => {
    const firstErrorField = document.querySelector('[aria-invalid="true"]') as HTMLElement | null
    firstErrorField?.focus()
  }

  const validateCurrentStep = (): boolean => {
    const stepErrors: FormErrors = {}
    const currentYear = getCurrentYear()

    if (currentStepIndex === 0) {
      if (!profileData.businessName.trim()) {
        stepErrors.businessName = 'Business name is required.'
      } else if (profileData.businessName.length > BUSINESS_NAME_MAX_LENGTH) {
        stepErrors.businessName = `Business name must be ${BUSINESS_NAME_MAX_LENGTH} characters or fewer.`
      }
      if (!profileData.ownerName.trim()) {
        stepErrors.ownerName = 'Owner name is required.'
      } else if (profileData.ownerName.length > OWNER_NAME_MAX_LENGTH) {
        stepErrors.ownerName = `Owner name must be ${OWNER_NAME_MAX_LENGTH} characters or fewer.`
      }
      if (!profileData.businessCategory) {
        stepErrors.businessCategory = 'Please select a category.'
      }
      if (profileData.tagline.length > TAGLINE_MAX_LENGTH) {
        stepErrors.tagline = `Tagline must be ${TAGLINE_MAX_LENGTH} characters or fewer.`
      }
      if (!businessExperienceValue.trim()) {
        stepErrors.establishedYear = 'Established year or years of experience is required.'
      } else if (businessExperienceValue.length > BUSINESS_EXPERIENCE_MAX_LENGTH) {
        stepErrors.establishedYear = `Established year or years of experience must be ${BUSINESS_EXPERIENCE_MAX_LENGTH} characters or fewer.`
      } else if (!profileData.establishedYear.trim() && !profileData.yearsOfExperience.trim()) {
        stepErrors.establishedYear = 'Enter an established year, years of experience, or both.'
      } else if (profileData.establishedYear.trim()) {
        if (!isValidFourDigitYear(profileData.establishedYear.trim())) {
          stepErrors.establishedYear = 'Enter a valid four-digit year.'
        } else if (Number(profileData.establishedYear) > currentYear) {
          stepErrors.establishedYear = 'Established year cannot be in the future.'
        }
      }
      if (profileData.yearsOfExperience.trim()) {
        const yearsOfExperience = Number(profileData.yearsOfExperience)
        if (!Number.isInteger(yearsOfExperience) || yearsOfExperience < 0) {
          stepErrors.yearsOfExperience = 'Years of experience must be 0 or more.'
        }
      }
    }

    if (currentStepIndex === 1) {
      if (!profileData.phoneNumber.trim()) {
        stepErrors.phoneNumber = 'Phone number is required.'
      } else if (!isValidIndianMobileNumber(profileData.phoneNumber)) {
        stepErrors.phoneNumber = 'Enter a valid 10-digit Indian mobile number starting with 6, 7, 8, or 9.'
      }
      if (profileData.whatsappNumber.trim() && !isValidIndianMobileNumber(profileData.whatsappNumber)) {
        stepErrors.whatsappNumber = 'Enter a valid 10-digit Indian mobile number starting with 6, 7, 8, or 9.'
      }
      if (!profileData.email.trim()) {
        stepErrors.email = 'Email address is required.'
      }
      if (!profileData.address.trim()) {
        stepErrors.address = 'Address is required.'
      }
      if (!profileData.googleMapsUrl.trim()) {
        stepErrors.googleMapsUrl = 'Google Maps link is required.'
      } else if (!isValidOptionalUrl(profileData.googleMapsUrl)) {
        stepErrors.googleMapsUrl = 'Enter a valid Google Maps URL.'
      }
    }

    if (currentStepIndex === 2) {
      if (!profileData.aboutBusiness.trim()) {
        stepErrors.aboutBusiness = 'About business is required.'
      } else if (profileData.aboutBusiness.length > ABOUT_BUSINESS_MAX_LENGTH) {
        stepErrors.aboutBusiness = `About business must be ${ABOUT_BUSINESS_MAX_LENGTH} characters or fewer.`
      }
      if (
        profileData.productsMenuPackages.length > MAX_PRODUCTS_MENU_PACKAGES ||
        profileData.productsMenuPackages.some(
          (item) =>
            item.name.length > PRODUCT_ITEM_NAME_MAX_LENGTH ||
            item.description.length > PRODUCT_DESCRIPTION_MAX_LENGTH ||
            item.price.length > PRODUCT_PRICE_MAX_LENGTH
        )
      ) {
        stepErrors.productsMenuPackages =
          profileData.productsMenuPackages.length > MAX_PRODUCTS_MENU_PACKAGES
            ? `Add up to ${MAX_PRODUCTS_MENU_PACKAGES} items only.`
            : `Keep item name within ${PRODUCT_ITEM_NAME_MAX_LENGTH} characters, description within ${PRODUCT_DESCRIPTION_MAX_LENGTH} characters, and price within ${PRODUCT_PRICE_MAX_LENGTH} characters.`
      }
      if (profileData.keywordsText.length > KEYWORDS_TEXT_MAX_LENGTH) {
        stepErrors.keywordsText = `Business keywords / tags must be ${KEYWORDS_TEXT_MAX_LENGTH} characters or fewer.`
      }
      if (
        profileData.faqs.length > MAX_FAQS ||
        profileData.faqs.some(
          (item) =>
            item.question.length > FAQ_QUESTION_MAX_LENGTH ||
            item.answer.length > FAQ_ANSWER_MAX_LENGTH
        )
      ) {
        stepErrors.faqs =
          profileData.faqs.length > MAX_FAQS
            ? `Add up to ${MAX_FAQS} FAQs only.`
            : `Keep FAQ questions within ${FAQ_QUESTION_MAX_LENGTH} characters and answers within ${FAQ_ANSWER_MAX_LENGTH} characters.`
      }
      if (!hasWorkingHoursData(profileData.workingHours)) {
        stepErrors.workingHours = 'Working hours are required.'
      } else if (hasIncompleteWorkingHours(profileData.workingHours)) {
        stepErrors.workingHours = 'Provide both open and close times, or mark the day closed.'
      }
    }

    if (currentStepIndex === 3) {
      if (profileData.existingGalleryImageUrls.length + profileData.galleryImages.length === 0) {
        stepErrors.galleryImages = 'Business gallery requires at least one image.'
      }
    }

    if (currentStepIndex === 4) {
      if (
        profileData.qualifications.length > MAX_QUALIFICATIONS ||
        profileData.qualifications.some(
          (item) =>
            item.title.length > QUALIFICATION_TITLE_MAX_LENGTH ||
            item.issuingOrganization.length > QUALIFICATION_ISSUING_ORGANIZATION_MAX_LENGTH ||
            item.description.length > QUALIFICATION_DESCRIPTION_MAX_LENGTH
        )
      ) {
        stepErrors.qualifications =
          profileData.qualifications.length > MAX_QUALIFICATIONS
            ? `Add up to ${MAX_QUALIFICATIONS} credentials only.`
            : `Keep qualification name within ${QUALIFICATION_TITLE_MAX_LENGTH} characters, issuing organization within ${QUALIFICATION_ISSUING_ORGANIZATION_MAX_LENGTH} characters, and description within ${QUALIFICATION_DESCRIPTION_MAX_LENGTH} characters.`
      }
      if (profileData.documentName.length > DOCUMENT_NAME_MAX_LENGTH) {
        stepErrors.documentName = `Document name must be ${DOCUMENT_NAME_MAX_LENGTH} characters or fewer.`
      }
    }

    setErrors((prev) => ({
      ...prev,
      businessName: currentStepIndex === 0 ? stepErrors.businessName : prev.businessName,
      ownerName: currentStepIndex === 0 ? stepErrors.ownerName : prev.ownerName,
      businessCategory: currentStepIndex === 0 ? stepErrors.businessCategory : prev.businessCategory,
      establishedYear: currentStepIndex === 0 ? stepErrors.establishedYear : prev.establishedYear,
      yearsOfExperience: currentStepIndex === 0 ? stepErrors.yearsOfExperience : prev.yearsOfExperience,
      phoneNumber: currentStepIndex === 1 ? stepErrors.phoneNumber : prev.phoneNumber,
      whatsappNumber: currentStepIndex === 1 ? stepErrors.whatsappNumber : prev.whatsappNumber,
      email: currentStepIndex === 1 ? stepErrors.email : prev.email,
      address: currentStepIndex === 1 ? stepErrors.address : prev.address,
      googleMapsUrl: currentStepIndex === 1 ? stepErrors.googleMapsUrl : prev.googleMapsUrl,
      aboutBusiness: currentStepIndex === 2 ? stepErrors.aboutBusiness : prev.aboutBusiness,
      productsMenuPackages:
        currentStepIndex === 2 ? stepErrors.productsMenuPackages : prev.productsMenuPackages,
      keywordsText: currentStepIndex === 2 ? stepErrors.keywordsText : prev.keywordsText,
      faqs: currentStepIndex === 2 ? stepErrors.faqs : prev.faqs,
      workingHours: currentStepIndex === 2 ? stepErrors.workingHours : prev.workingHours,
      galleryImages: currentStepIndex === 3 ? stepErrors.galleryImages : prev.galleryImages,
      qualifications: currentStepIndex === 4 ? stepErrors.qualifications : prev.qualifications,
      documentName: currentStepIndex === 4 ? stepErrors.documentName : prev.documentName,
    }))

    return Object.keys(stepErrors).length === 0
  }

  const handleNextStep = () => {
    if (!validateCurrentStep()) {
      window.setTimeout(focusFirstErrorField, 0)
      return
    }

    const nextStep = Math.min(currentStepIndex + 1, FORM_STEPS.length - 1)
    shouldScrollStepIntoViewRef.current = true
    writeCreateProfileStepIndex(stepStorageKey, nextStep)
    setCurrentStepIndex(nextStep)
  }

  const handlePreviousStep = () => {
    const nextStep = Math.max(currentStepIndex - 1, 0)
    shouldScrollStepIntoViewRef.current = true
    writeCreateProfileStepIndex(stepStorageKey, nextStep)
    setCurrentStepIndex(nextStep)
  }

  const handleContinue = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    const isValid = validate()
    if (!isValid) {
      setIsSubmitting(false)
      focusFirstErrorField()
      return
    }

    if (!isEditMode) {
      navigate('/profile-preview')
      return
    }

    try {
      const updated = await updateBusinessProfile(profileData.id as string, profileData)
      removeCreateProfileStepIndex(stepStorageKey)
      setProfileData({
        ...profileData,
        businessName: updated.business_name,
        ownerName: updated.owner_name,
        businessCategory: updated.business_category,
        businessSubcategories:
          updated.business_subcategories === undefined
            ? profileData.businessSubcategories
            : normalizeSubcategoryValues(updated.business_subcategories),
        establishedYear: profileData.establishedYear,
        yearsOfExperience: profileData.yearsOfExperience,
        highlights: profileData.highlights,
        faqs: profileData.faqs.filter((item) => !isBlankFaqItem(item)),
        productsMenuPackages: profileData.productsMenuPackages.filter(
          (item) => !isBlankProductItem(item)
        ),
        qualifications: normalizeQualificationItems(updated.qualifications),
        phoneNumber: toIndianMobileDisplayValue(updated.phone_number),
        whatsappNumber: toIndianMobileDisplayValue(updated.whatsapp_number || ''),
        email: updated.email || '',
        website: updated.website || '',
        address: updated.address || '',
        aboutBusiness: updated.about_business || '',
        tagline: updated.tagline || '',
        servicesText: Array.isArray(updated.services)
          ? updated.services.filter((service): service is string => typeof service === 'string').join('\n')
          : '',
        workingHours: profileData.workingHours,
        googleMapsUrl: updated.google_maps_url || '',
        socialLinks: profileData.socialLinks,
        keywordsText: Array.isArray(updated.keywords) ? updated.keywords.join(', ') : '',
        isPublic: updated.is_public ?? true,
        id: updated.id,
        slug: updated.slug,
        logo: null,
        existingLogoUrl: updated.logo_url,
        coverBanner: null,
        existingCoverBannerUrl: updated.cover_banner_url,
        galleryImages: [],
        existingGalleryImageUrls: Array.isArray(updated.gallery_images) ? updated.gallery_images : [],
        documentName: '',
        documentFiles: [],
        existingDocuments: profileData.existingDocuments,
      })
      navigate(accountMode === 'business_owner' ? '/business-home' : '/dashboard', {
        state: { profileUpdated: true },
      })
    } catch (error) {
      console.error('Failed to update business profile:', error)
      showToast('Something went wrong while updating. Please try again.', 'error')
      setIsSubmitting(false)
    }
  }

  const handleClearForm = () => {
    const confirmed = window.confirm(
      'Are you sure you want to clear all form data? This cannot be undone.'
    )
    if (!confirmed) return
    removeCreateProfileStepIndex(stepStorageKey)
    removeCreateProfileStepIndex(getCreateProfileStepStorageKey(null))
    clearProfile()
    setCurrentStepIndex(0)
    setErrors({})
    setSocialLinkRowErrors({})
    setSocialLinkRows(createSocialLinkRows(createDefaultSocialLinks()))
    setLogoFileName('')
    setCoverBannerFileName('')
    setBusinessExperienceValue('')
    if (logoInputRef.current) {
      logoInputRef.current.value = ''
    }
    if (coverBannerInputRef.current) {
      coverBannerInputRef.current.value = ''
    }
    if (galleryInputRef.current) {
      galleryInputRef.current.value = ''
    }
    if (documentInputRef.current) {
      documentInputRef.current.value = ''
    }
  }

  const inputBase =
    'w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-[0_1px_2px_rgba(15,23,42,0.04),inset_0_1px_0_rgba(255,255,255,0.7)] transition duration-200 placeholder:text-slate-400 focus:border-sky-500 focus:outline-none focus:ring-4 focus:ring-sky-100'
  const textareaBase = `${inputBase} min-h-[108px] resize-y`
  const fileInputBase =
    `${inputBase} cursor-pointer px-3 py-2.5 file:mr-4 file:rounded-xl file:border-0 file:bg-slate-900 file:px-4 file:py-2 file:text-xs file:font-semibold file:text-white hover:file:bg-slate-800`
  const sectionCardClass =
    'rounded-[26px] border border-slate-200/80 bg-[linear-gradient(180deg,rgba(248,250,252,0.98),rgba(241,245,249,0.92))] p-5 shadow-[0_18px_40px_-34px_rgba(15,23,42,0.38)] sm:p-7'
  const labelClass = 'mb-2 block text-sm font-medium text-slate-700'
  const optionalTextClass = 'ml-2 text-xs font-normal text-slate-400'
  const compactFieldLabelClass = 'mb-1.5 block text-xs font-semibold uppercase tracking-[0.08em] text-slate-500'

  const fieldError = (key: keyof FormErrors) =>
    errors[key] ? (
      <p
        id={`${key}-error`}
        role="alert"
        className="mt-2 flex items-center gap-1 text-xs text-red-600"
      >
        <svg className="w-3 h-3 shrink-0" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
        </svg>
        {errors[key]}
      </p>
    ) : null

  const characterCounter = (id: string, value: string, maxLength: number) => (
    <p id={id} className="mt-2 text-xs text-slate-400">
      {value.length} / {maxLength}
    </p>
  )

  if (isForbidden) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-white to-slate-50 flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center">
          <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-6">
            <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">403 - Access Denied</h1>
          <p className="text-sm text-gray-500 mb-8">
            You don&apos;t have permission to edit this business profile. It belongs to another user.
          </p>
          <button
            type="button"
            onClick={() => navigate('/')}
            className="inline-flex items-center justify-center gap-2 px-8 py-3 text-sm font-semibold text-white bg-blue-600 rounded-full hover:bg-blue-700 active:scale-95 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Home
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-[linear-gradient(180deg,#020617_0%,#030712_34%,#020617_100%)]">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-[radial-gradient(circle_at_top,rgba(56,189,248,0.16),transparent_62%)]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-32 h-[34rem] w-[34rem] -translate-x-1/2 rounded-full bg-sky-400/10 blur-[150px]"
      />

      <div className="relative">
        <AppHeader />

        <main className="relative mx-auto max-w-5xl px-4 pb-16 pt-10 sm:px-6 sm:pt-14 lg:px-8">
          <ToastContainer toasts={toasts} />
          <div className="relative overflow-hidden rounded-[32px] border border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.96))] px-5 py-6 shadow-[0_40px_120px_-48px_rgba(2,12,27,0.85)] sm:px-8 sm:py-10 lg:px-12 lg:py-12">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-[linear-gradient(180deg,rgba(255,255,255,0.75),rgba(255,255,255,0))]"
            />

            <div className="relative">
              <div className="mx-auto mb-8 max-w-2xl text-center sm:mb-10">
                <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
                  <span className="create-profile-heading-reveal inline-block leading-tight">
                    {isEditMode ? 'Edit Your Business Profile' : 'Create Your Business Profile'}
                  </span>
                </h1>
                <p className="mt-3 text-sm leading-6 text-slate-500 sm:text-[0.95rem]">
                  Add the details customers need to discover, trust, and contact your business.
                </p>
                <div aria-hidden="true" className="mt-6 h-px w-full bg-slate-200/80" />
              </div>

              <form onSubmit={handleContinue} noValidate className="space-y-6 sm:space-y-7">
          <div ref={stepContentRef} className="space-y-6 sm:space-y-7">
          <StepProgressIndicator currentStepIndex={currentStepIndex} steps={FORM_STEPS} />

          {/* -- Basic Information -- */}
          {currentStepIndex === 0 && (
          <section className={sectionCardClass} aria-labelledby="section-basic">
            <FormSectionHeading
              id="section-basic"
              title="Basic Business Details"
              description="Add the core details customers will see first."
            />
            <div className="grid gap-5 md:grid-cols-2">

              <div className="md:col-span-2">
                <label htmlFor="businessName" className={labelClass}>
                  Business Name <span className="text-red-500" aria-hidden="true">*</span>
                </label>
                <input
                  type="text"
                  id="businessName"
                  name="businessName"
                  value={profileData.businessName}
                  onChange={handleChange}
                  maxLength={BUSINESS_NAME_MAX_LENGTH}
                  placeholder="e.g. Sunrise Bakery"
                  autoComplete="organization"
                  aria-required="true"
                  aria-invalid={!!errors.businessName}
                  aria-describedby={
                    errors.businessName
                      ? 'businessName-error businessName-counter'
                      : 'businessName-counter'
                  }
                  className={`${inputBase} ${errors.businessName ? 'border-red-400 bg-red-50/60 focus:border-red-400 focus:ring-red-100' : ''}`}
                />
                {fieldError('businessName')}
                {characterCounter('businessName-counter', profileData.businessName, BUSINESS_NAME_MAX_LENGTH)}
              </div>

              <div>
                <label htmlFor="ownerName" className={labelClass}>
                  Owner Name <span className="text-red-500" aria-hidden="true">*</span>
                </label>
                <input
                  type="text"
                  id="ownerName"
                  name="ownerName"
                  value={profileData.ownerName}
                  onChange={handleChange}
                  maxLength={OWNER_NAME_MAX_LENGTH}
                  placeholder="e.g. Sarah Johnson"
                  autoComplete="name"
                  aria-required="true"
                  aria-invalid={!!errors.ownerName}
                  aria-describedby={
                    errors.ownerName
                      ? 'ownerName-error ownerName-counter'
                      : 'ownerName-counter'
                  }
                  className={`${inputBase} ${errors.ownerName ? 'border-red-400 bg-red-50/60 focus:border-red-400 focus:ring-red-100' : ''}`}
                />
                {fieldError('ownerName')}
                {characterCounter('ownerName-counter', profileData.ownerName, OWNER_NAME_MAX_LENGTH)}
              </div>

              <div>
                <label htmlFor="businessCategory" className={labelClass}>
                  Business Category <span className="text-red-500" aria-hidden="true">*</span>
                </label>
                <select
                  id="businessCategory"
                  name="businessCategory"
                  value={profileData.businessCategory}
                  onChange={handleChange}
                  aria-required="true"
                  aria-invalid={!!errors.businessCategory}
                  aria-describedby={errors.businessCategory ? 'businessCategory-error' : undefined}
                  className={`${inputBase} bg-white ${errors.businessCategory ? 'border-red-400 bg-red-50/60 focus:border-red-400 focus:ring-red-100' : ''}`}
                >
                  <option value="">Select a category</option>
                  {categoryOptions.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
                {fieldError('businessCategory')}
              </div>

              {profileData.businessCategory && (
                <div className="md:col-span-2">
                  <div className="rounded-2xl border border-slate-200 bg-white/85 p-4 sm:p-5">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                      <div>
                        <label htmlFor="businessSubcategories" className={labelClass}>
                          Subcategories
                          <span className={optionalTextClass}>Optional</span>
                        </label>
                        <p className="mt-2 text-xs text-slate-400">
                          Select up to 8 subcategories.
                        </p>
                      </div>
                      <p className="text-xs font-medium text-slate-500">
                        {profileData.businessSubcategories.length} / {MAX_SUBCATEGORIES} selected
                      </p>
                    </div>

                    <div ref={subcategoryDropdownRef} className="relative mt-4">
                      <button
                        type="button"
                        id="businessSubcategories"
                        aria-haspopup="listbox"
                        aria-expanded={isSubcategoryDropdownOpen}
                        aria-describedby={
                          errors.businessSubcategories
                            ? 'businessSubcategories-error'
                            : 'businessSubcategories-help'
                        }
                        onClick={() => setIsSubcategoryDropdownOpen((open) => !open)}
                        className={`${inputBase} flex items-center justify-between text-left ${
                          errors.businessSubcategories
                            ? 'border-red-400 bg-red-50/60 focus:border-red-400 focus:ring-red-100'
                            : ''
                        }`}
                      >
                        <span
                          className={
                            profileData.businessSubcategories.length > 0
                              ? 'text-slate-900'
                              : 'text-slate-400'
                          }
                        >
                          {selectedSubcategorySummary}
                        </span>
                        <svg
                          className={`h-4 w-4 shrink-0 text-slate-500 transition-transform ${
                            isSubcategoryDropdownOpen ? 'rotate-180' : ''
                          }`}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                          aria-hidden="true"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>

                      {isSubcategoryDropdownOpen && (
                        <div className="absolute left-0 right-0 top-[calc(100%+0.5rem)] z-20 rounded-2xl border border-slate-200 bg-white shadow-[0_18px_40px_-24px_rgba(15,23,42,0.24)]">
                          {profileData.businessSubcategories.length > 0 && (
                            <div className="border-b border-slate-100 px-4 py-3">
                              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
                                Selected
                              </p>
                              <div className="mt-2 flex flex-wrap gap-2">
                                {profileData.businessSubcategories.map((subcategory) => (
                                  <button
                                    key={subcategory}
                                    type="button"
                                    onClick={() => handleRemoveSubcategory(subcategory)}
                                    className="inline-flex items-center gap-2 rounded-full border border-sky-200 bg-sky-50 px-3 py-1.5 text-xs font-medium text-sky-700 transition hover:bg-sky-100 focus:outline-none focus:ring-2 focus:ring-sky-200"
                                  >
                                    {subcategory}
                                    <svg
                                      className="h-3 w-3 shrink-0"
                                      fill="none"
                                      stroke="currentColor"
                                      viewBox="0 0 24 24"
                                      aria-hidden="true"
                                    >
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}

                          <div
                            role="listbox"
                            aria-multiselectable="true"
                            className="max-h-72 overflow-y-auto px-2 py-2"
                          >
                            {availableSubcategories.map((subcategory) => {
                              const isSelected = profileData.businessSubcategories.includes(subcategory)
                              const limitReached =
                                !isSelected &&
                                profileData.businessSubcategories.length >= MAX_SUBCATEGORIES

                              return (
                                <label
                                  key={subcategory}
                                  className={`flex cursor-pointer items-start gap-3 rounded-xl px-3 py-2.5 text-sm transition ${
                                    limitReached
                                      ? 'cursor-not-allowed opacity-60'
                                      : 'hover:bg-slate-50'
                                  }`}
                                >
                                  <input
                                    type="checkbox"
                                    checked={isSelected}
                                    disabled={limitReached}
                                    onChange={() => handleSubcategoryToggle(subcategory)}
                                    className="mt-0.5 h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-2 focus:ring-sky-200"
                                  />
                                  <span className="text-slate-700">{subcategory}</span>
                                </label>
                              )
                            })}
                          </div>
                        </div>
                      )}
                    </div>

                    <p id="businessSubcategories-help" className="mt-2 text-xs text-slate-400">
                      {selectedSubcategorySummary}
                    </p>
                    {fieldError('businessSubcategories')}
                  </div>
                </div>
              )}

              <div>
                <label htmlFor="tagline" className={labelClass}>
                  Business Tagline
                  <span className={optionalTextClass}>Optional</span>
                </label>
                <input
                  type="text"
                  id="tagline"
                  name="tagline"
                  value={profileData.tagline}
                  onChange={handleChange}
                  maxLength={TAGLINE_MAX_LENGTH}
                  placeholder="Example: Trusted local dental care for your family"
                  aria-invalid={!!errors.tagline}
                  aria-describedby={
                    errors.tagline
                      ? 'tagline-error tagline-counter tagline-help'
                      : 'tagline-counter tagline-help'
                  }
                  className={`${inputBase} ${errors.tagline ? 'border-red-400 bg-red-50/60 focus:border-red-400 focus:ring-red-100' : ''}`}
                />
                {fieldError('tagline')}
                {characterCounter('tagline-counter', profileData.tagline, TAGLINE_MAX_LENGTH)}
                <p id="tagline-help" className="mt-2 text-xs text-slate-400">
                  This appears under the business name on the public profile.
                </p>
              </div>

            <div>
              <label htmlFor="businessExperience" className={labelClass}>
                Established Year / Years of Experience <span className="text-red-500" aria-hidden="true">*</span>
              </label>
              <input
                type="text"
                id="businessExperience"
                value={businessExperienceValue}
                onChange={(e) => handleBusinessExperienceChange(e.target.value)}
                maxLength={BUSINESS_EXPERIENCE_MAX_LENGTH}
                placeholder="Established in 2018 / 7 years experience"
                aria-required="true"
                aria-invalid={!!errors.establishedYear || !!errors.yearsOfExperience}
                aria-describedby={
                  errors.establishedYear
                    ? 'establishedYear-error businessExperience-counter businessExperience-help'
                    : errors.yearsOfExperience
                      ? 'yearsOfExperience-error businessExperience-counter businessExperience-help'
                      : 'businessExperience-counter businessExperience-help'
                }
                className={`${inputBase} ${
                  errors.establishedYear || errors.yearsOfExperience
                    ? 'border-red-400 bg-red-50/60 focus:border-red-400 focus:ring-red-100'
                    : ''
                }`}
              />
              {fieldError('establishedYear')}
              {fieldError('yearsOfExperience')}
              {characterCounter('businessExperience-counter', businessExperienceValue, BUSINESS_EXPERIENCE_MAX_LENGTH)}
              <p id="businessExperience-help" className="mt-2 text-xs text-slate-400">
                Use a four-digit established year, years of experience, or both.
              </p>
            </div>
            </div>
          </section>
          )}

          {currentStepIndex === 1 && (
          <section className={sectionCardClass} aria-labelledby="section-contact">
            <FormSectionHeading
              id="section-contact"
              title="Contact & Location Details"
              description="Add contact options customers can use to reach you."
            />
            <div className="grid gap-5 md:grid-cols-2">

              <div>
                <label htmlFor="phoneNumber" className={labelClass}>
                  Phone Number <span className="text-red-500" aria-hidden="true">*</span>
                </label>
                <div
                  className={`flex overflow-hidden rounded-2xl border bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04),inset_0_1px_0_rgba(255,255,255,0.7)] transition duration-200 focus-within:border-sky-500 focus-within:ring-4 focus-within:ring-sky-100 ${
                    errors.phoneNumber ? 'border-red-400 bg-red-50/60 focus-within:border-red-400 focus-within:ring-red-100' : 'border-slate-200'
                  }`}
                >
                  <span className="flex items-center border-r border-slate-200 bg-slate-50 px-4 text-sm font-medium text-slate-600">
                    {INDIA_COUNTRY_CODE}
                  </span>
                  <input
                    type="tel"
                    id="phoneNumber"
                    name="phoneNumber"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={INDIAN_MOBILE_NUMBER_LENGTH}
                    value={profileData.phoneNumber}
                    onChange={(e) => handleIndianMobileChange('phoneNumber', e.target.value)}
                    placeholder="9876543210"
                    autoComplete="tel-national"
                    aria-required="true"
                    aria-invalid={!!errors.phoneNumber}
                    aria-describedby={errors.phoneNumber ? 'phoneNumber-error' : 'phoneNumber-help'}
                    className="w-full bg-transparent px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none"
                  />
                </div>
                {fieldError('phoneNumber')}
                <p id="phoneNumber-help" className="mt-2 text-xs text-slate-400">
                  Enter a 10-digit Indian mobile number starting with 6, 7, 8, or 9.
                </p>
              </div>

              <div>
                <label htmlFor="whatsappNumber" className={labelClass}>
                  WhatsApp Number
                  <span className={optionalTextClass}>Optional</span>
                </label>
                <div
                  className={`flex overflow-hidden rounded-2xl border bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04),inset_0_1px_0_rgba(255,255,255,0.7)] transition duration-200 focus-within:border-sky-500 focus-within:ring-4 focus-within:ring-sky-100 ${
                    errors.whatsappNumber ? 'border-red-400 bg-red-50/60 focus-within:border-red-400 focus-within:ring-red-100' : 'border-slate-200'
                  }`}
                >
                  <span className="flex items-center border-r border-slate-200 bg-slate-50 px-4 text-sm font-medium text-slate-600">
                    {INDIA_COUNTRY_CODE}
                  </span>
                  <input
                    type="tel"
                    id="whatsappNumber"
                    name="whatsappNumber"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={INDIAN_MOBILE_NUMBER_LENGTH}
                    value={profileData.whatsappNumber}
                    onChange={(e) => handleIndianMobileChange('whatsappNumber', e.target.value)}
                    placeholder="9876543210"
                    autoComplete="tel-national"
                    aria-invalid={!!errors.whatsappNumber}
                    aria-describedby={errors.whatsappNumber ? 'whatsappNumber-error' : 'whatsappNumber-help'}
                    className="w-full bg-transparent px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none"
                  />
                </div>
                {fieldError('whatsappNumber')}
                <p id="whatsappNumber-help" className="mt-2 text-xs text-slate-400">
                  Leave blank to use your phone number for WhatsApp.
                </p>
              </div>

              <div>
                <label htmlFor="email" className={labelClass}>
                  Email Address <span className="text-red-500" aria-hidden="true">*</span>
                </label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={profileData.email}
                  onChange={handleChange}
                  placeholder="e.g. hello@yourbusiness.com"
                  autoComplete="email"
                  aria-required="true"
                  aria-invalid={!!errors.email}
                  aria-describedby={errors.email ? 'email-error' : undefined}
                  className={`${inputBase} ${errors.email ? 'border-red-400 bg-red-50/60 focus:border-red-400 focus:ring-red-100' : ''}`}
                />
                {fieldError('email')}
              </div>

                <div>
                  <label htmlFor="address" className={labelClass}>
                    Address <span className="text-red-500" aria-hidden="true">*</span>
                  </label>
                  <textarea
                    id="address"
                    name="address"
                    rows={3}
                    value={profileData.address}
                    onChange={handleChange}
                    placeholder="e.g. 123 Main Street, Suite 4&#10;New York, NY 10001"
                    aria-required="true"
                    aria-invalid={!!errors.address}
                    aria-describedby={errors.address ? 'address-error' : undefined}
                    className={`${textareaBase} ${errors.address ? 'border-red-400 bg-red-50/60 focus:border-red-400 focus:ring-red-100' : ''}`}
                  />
                  {fieldError('address')}
                </div>

                <div>
                  <label htmlFor="googleMapsUrl" className={labelClass}>
                    Google Maps Link <span className="text-red-500" aria-hidden="true">*</span>
                  </label>
                  <input
                    type="url"
                    id="googleMapsUrl"
                    name="googleMapsUrl"
                    value={profileData.googleMapsUrl}
                    onChange={handleChange}
                    placeholder="https://maps.google.com/..."
                    aria-required="true"
                    aria-invalid={!!errors.googleMapsUrl}
                    aria-describedby={errors.googleMapsUrl ? 'googleMapsUrl-error' : undefined}
                    className={`${inputBase} ${errors.googleMapsUrl ? 'border-red-400 bg-red-50/60 focus:border-red-400 focus:ring-red-100' : ''}`}
                  />
                  {fieldError('googleMapsUrl')}
                </div>

              <div>
                <label htmlFor="website" className={labelClass}>
                  Website
                  <span className={optionalTextClass}>Optional</span>
                </label>
                <input
                  type="url"
                  id="website"
                  name="website"
                  value={profileData.website}
                  onChange={handleChange}
                  placeholder="e.g. https://yourbusiness.com"
                  autoComplete="url"
                  className={inputBase}
                />
              </div>
            </div>

            <div className="mt-5">
              <FormSubsectionHeading
                id="section-online"
                title="Social Links"
                description="Add your official social profiles. Use the + button to add more platforms if needed."
                action={
                  socialLinkRows.length < MAX_SOCIAL_LINKS ? (
                    <button
                      type="button"
                      onClick={handleAddSocialLinkRow}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-lg font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-200"
                      aria-label="Add social link"
                    >
                      +
                    </button>
                  ) : null
                }
              />
              <div className="space-y-4">
              {socialLinkRows.map((row, index) => {
                const rowError = socialLinkRowErrors[row.id]

                return (
                  <div
                    key={row.id}
                    className="rounded-2xl border border-slate-200 bg-white/85 p-4"
                  >
                    <div className="grid gap-3 md:grid-cols-[minmax(0,210px)_minmax(0,1fr)_auto] md:items-start">
                      <div>
                        <label htmlFor={`social-platform-${row.id}`} className={compactFieldLabelClass}>
                          Platform Name
                        </label>
                        <input
                          type="text"
                          id={`social-platform-${row.id}`}
                          value={row.platform}
                          onChange={(e) => handleSocialLinkChange(row.id, 'platform', e.target.value)}
                          placeholder={index === 0 ? 'Instagram' : index === 1 ? 'Facebook' : 'LinkedIn'}
                          aria-invalid={!!rowError}
                          aria-describedby={rowError ? `social-link-${row.id}-error` : undefined}
                          className={`${inputBase} ${rowError ? 'border-red-400 bg-red-50/60 focus:border-red-400 focus:ring-red-100' : ''}`}
                        />
                      </div>

                      <div>
                        <label htmlFor={`social-url-${row.id}`} className={compactFieldLabelClass}>
                          Profile Link
                        </label>
                        <input
                          type="url"
                          id={`social-url-${row.id}`}
                          value={row.url}
                          onChange={(e) => handleSocialLinkChange(row.id, 'url', e.target.value)}
                          placeholder={getSocialLinkPlaceholder(row.platform)}
                          aria-invalid={!!rowError}
                          aria-describedby={rowError ? `social-link-${row.id}-error` : undefined}
                          className={`${inputBase} ${rowError ? 'border-red-400 bg-red-50/60 focus:border-red-400 focus:ring-red-100' : ''}`}
                        />
                      </div>

                      <div className="md:pt-[1.85rem]">
                        {index >= 2 ? (
                          <button
                            type="button"
                            onClick={() => handleRemoveSocialLinkRow(row.id)}
                            className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600 transition hover:border-slate-300 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-slate-200"
                          >
                            Remove
                          </button>
                        ) : null}
                      </div>
                    </div>

                    {rowError ? (
                      <p
                        id={`social-link-${row.id}-error`}
                        role="alert"
                        className="mt-3 flex items-center gap-1 text-xs text-red-600"
                      >
                        <svg className="h-3 w-3 shrink-0" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                        {rowError}
                      </p>
                    ) : null}
                  </div>
                )
              })}
              </div>
            </div>
          </section>
          )}

          {currentStepIndex === 2 && (
          <section className={sectionCardClass} aria-labelledby="section-business">
            <FormSectionHeading
              id="section-business"
              title="Business Overview & Offerings"
              description="Describe your business, offerings, keywords, availability, and common customer questions."
            />
            <div className="space-y-5">
              <div>
                <label htmlFor="aboutBusiness" className={labelClass}>
                  About Business <span className="text-red-500" aria-hidden="true">*</span>
                </label>
                <textarea
                  id="aboutBusiness"
                  name="aboutBusiness"
                  rows={4}
                  value={profileData.aboutBusiness}
                  onChange={handleChange}
                  maxLength={ABOUT_BUSINESS_MAX_LENGTH}
                  placeholder="A short description of your business, what you offer, and what makes you unique..."
                  aria-required="true"
                  aria-invalid={!!errors.aboutBusiness}
                  aria-describedby={
                    errors.aboutBusiness
                      ? 'aboutBusiness-error aboutBusiness-counter'
                      : 'aboutBusiness-counter'
                  }
                  className={`${textareaBase} min-h-[124px] ${errors.aboutBusiness ? 'border-red-400 bg-red-50/60 focus:border-red-400 focus:ring-red-100' : ''}`}
                />
                {fieldError('aboutBusiness')}
                {characterCounter('aboutBusiness-counter', profileData.aboutBusiness, ABOUT_BUSINESS_MAX_LENGTH)}
              </div>

            <FormSubsectionHeading
              id="section-products"
              title="Products / Menu / Packages / Services"
              description="Add optional offerings such as products, menu items, or service packages."
              action={
                profileData.productsMenuPackages.length < MAX_PRODUCTS_MENU_PACKAGES ? (
                  <button
                    type="button"
                    onClick={handleAddProduct}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-lg font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-200"
                    aria-label="Add product, menu item, or package"
                  >
                    +
                  </button>
                ) : undefined
              }
            />

            <div className="space-y-4">
              {profileData.productsMenuPackages.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-white/60 px-4 py-5 text-sm text-slate-500">
                  No product, menu, or package items added yet.
                </div>
              ) : (
                profileData.productsMenuPackages.map((item, index) => (
                  <div key={item.id} className="rounded-2xl border border-slate-200 bg-white/85 p-4 sm:p-5">
                    <div className="mb-4 flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-slate-800">Item {index + 1}</p>
                      <button
                        type="button"
                        onClick={() => handleRemoveProduct(item.id)}
                        className="inline-flex items-center justify-center rounded-full border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-medium text-rose-700 transition hover:bg-rose-100 focus:outline-none focus:ring-2 focus:ring-rose-200"
                      >
                        Remove
                      </button>
                    </div>

                    <div className="grid gap-4">
                      <div>
                        <label htmlFor={`product-name-${item.id}`} className={compactFieldLabelClass}>
                          Item Name <span className="text-red-500" aria-hidden="true">*</span>
                        </label>
                        <input
                          type="text"
                          id={`product-name-${item.id}`}
                          value={item.name}
                          onChange={(e) => handleProductChange(item.id, 'name', e.target.value)}
                          maxLength={PRODUCT_ITEM_NAME_MAX_LENGTH}
                          placeholder="e.g. Dental Checkup, Haircut Package, Veg Thali, Website Design"
                          aria-required="true"
                          aria-invalid={!!errors.productsMenuPackages}
                          aria-describedby={
                            errors.productsMenuPackages
                              ? `productsMenuPackages-error product-name-counter-${item.id}`
                              : `product-name-counter-${item.id}`
                          }
                          className={`${inputBase} ${errors.productsMenuPackages ? 'border-red-400 bg-red-50/60 focus:border-red-400 focus:ring-red-100' : ''}`}
                        />
                        {characterCounter(`product-name-counter-${item.id}`, item.name, PRODUCT_ITEM_NAME_MAX_LENGTH)}
                      </div>

                      <div>
                        <label htmlFor={`product-description-${item.id}`} className={compactFieldLabelClass}>
                          Description <span className={optionalTextClass}>Optional</span>
                        </label>
                        <textarea
                          id={`product-description-${item.id}`}
                          value={item.description}
                          onChange={(e) => handleProductChange(item.id, 'description', e.target.value)}
                          maxLength={PRODUCT_DESCRIPTION_MAX_LENGTH}
                          placeholder="Short details about this product, menu item, package, or service."
                          aria-invalid={!!errors.productsMenuPackages}
                          aria-describedby={
                            errors.productsMenuPackages
                              ? `productsMenuPackages-error product-description-counter-${item.id}`
                              : `product-description-counter-${item.id}`
                          }
                          className={`${textareaBase} ${errors.productsMenuPackages ? 'border-red-400 bg-red-50/60 focus:border-red-400 focus:ring-red-100' : ''}`}
                        />
                        {characterCounter(
                          `product-description-counter-${item.id}`,
                          item.description,
                          PRODUCT_DESCRIPTION_MAX_LENGTH
                        )}
                      </div>

                      <div>
                        <label htmlFor={`product-price-${item.id}`} className={compactFieldLabelClass}>
                          Price or Price Range <span className="text-red-500" aria-hidden="true">*</span>
                        </label>
                        <input
                          type="text"
                          id={`product-price-${item.id}`}
                          value={item.price}
                          onChange={(e) => handleProductChange(item.id, 'price', e.target.value)}
                          maxLength={PRODUCT_PRICE_MAX_LENGTH}
                          placeholder="e.g. ₹499, ₹500 - ₹1500, Starting from ₹999"
                          aria-required="true"
                          aria-invalid={!!errors.productsMenuPackages}
                          aria-describedby={
                            errors.productsMenuPackages
                              ? `productsMenuPackages-error product-price-counter-${item.id}`
                              : `product-price-counter-${item.id}`
                          }
                          className={`${inputBase} ${errors.productsMenuPackages ? 'border-red-400 bg-red-50/60 focus:border-red-400 focus:ring-red-100' : ''}`}
                        />
                        {characterCounter(`product-price-counter-${item.id}`, item.price, PRODUCT_PRICE_MAX_LENGTH)}
                      </div>

                      <div>
                        <span className={compactFieldLabelClass}>
                          Image <span className={optionalTextClass}>Optional</span>
                        </span>
                        <div className="flex flex-wrap items-start gap-4">
                          {productImagePreviews[item.id] && (
                            <img
                              src={productImagePreviews[item.id]}
                              alt={`${item.name || 'Item'} preview`}
                              className="h-24 w-24 rounded-xl border border-slate-200 object-cover"
                            />
                          )}
                          <div className="flex flex-wrap items-center gap-2">
                            <input
                              type="file"
                              id={`product-image-${item.id}`}
                              accept={imageAccept}
                              onChange={(e) => handleProductImageChange(item.id, e)}
                              className="sr-only"
                            />
                            <label
                              htmlFor={`product-image-${item.id}`}
                              className="inline-flex cursor-pointer items-center rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-100 focus-within:ring-2 focus-within:ring-sky-200"
                            >
                              {item.imageFile || item.imageUrl ? 'Replace image' : 'Upload image'}
                            </label>
                            {(item.imageFile || item.imageUrl) && (
                              <button
                                type="button"
                                onClick={() => handleRemoveProductImage(item.id)}
                                className="inline-flex items-center rounded-full border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-medium text-rose-700 transition hover:bg-rose-100 focus:outline-none focus:ring-2 focus:ring-rose-200"
                              >
                                Remove image
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
            {fieldError('productsMenuPackages')}

                <div>
                  <label htmlFor="keywordsText" className={labelClass}>
                    Business Keywords / Tags
                    <span className={optionalTextClass}>Optional</span>
                  </label>
                  <textarea
                    id="keywordsText"
                    name="keywordsText"
                    rows={4}
                    value={profileData.keywordsText}
                    onChange={handleChange}
                    maxLength={KEYWORDS_TEXT_MAX_LENGTH}
                    placeholder="dentist, root canal, dental clinic, teeth cleaning"
                    aria-invalid={!!errors.keywordsText}
                    aria-describedby={
                      errors.keywordsText
                        ? 'keywordsText-error keywordsText-counter keywordsText-help'
                        : 'keywordsText-counter keywordsText-help'
                    }
                    className={`${textareaBase} min-h-[132px] ${errors.keywordsText ? 'border-red-400 bg-red-50/60 focus:border-red-400 focus:ring-red-100' : ''}`}
                  />
                  {fieldError('keywordsText')}
                  {characterCounter('keywordsText-counter', profileData.keywordsText, KEYWORDS_TEXT_MAX_LENGTH)}
                  <p id="keywordsText-help" className="mt-2 text-xs text-slate-400">
                    Separate keywords with commas. Use up to 300 characters total.
                  </p>
                </div>

            <FormSubsectionHeading
              id="section-hours"
              title={<>Working Hours <span className="text-red-500" aria-hidden="true">*</span></>}
              description="Show when your business is open so customers know when to reach you."
            />
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white/85">
              <div className="hidden border-b border-slate-200/80 bg-slate-50/80 px-4 py-3 md:grid md:grid-cols-[140px_minmax(0,170px)_minmax(0,170px)_auto] md:items-center md:gap-3">
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">Day</p>
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">Open Time</p>
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">Close Time</p>
                <p className="text-right text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
                  Closed
                </p>
              </div>

              {workingDays.map(({ key, label }) => {
                const day = profileData.workingHours[key]

                return (
                  <div
                    key={key}
                    className="border-b border-slate-200/80 px-4 py-3 last:border-b-0"
                  >
                    <div className="grid grid-cols-2 items-start gap-3 md:grid-cols-[140px_minmax(0,170px)_minmax(0,170px)_auto] md:items-center">
                      <p className="order-1 text-sm font-semibold text-slate-800">{label}</p>

                      <label
                        htmlFor={`${key}-closed`}
                        className="order-2 inline-flex items-center justify-self-start gap-2 whitespace-nowrap text-sm text-slate-500 md:order-4 md:justify-self-end"
                      >
                        <input
                          type="checkbox"
                          id={`${key}-closed`}
                          checked={day.closed}
                          onChange={(e) => handleClosedChange(key, e.target.checked)}
                          className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-2 focus:ring-sky-200 focus:ring-offset-0"
                        />
                        Closed
                      </label>

                      <div className="order-3 min-w-0 md:order-2">
                        <label htmlFor={`${key}-open`} className="mb-1.5 block text-xs font-medium text-slate-500 md:sr-only">
                          Open Time
                        </label>
                        <input
                          type="time"
                          id={`${key}-open`}
                          value={day.open}
                          disabled={day.closed}
                          onChange={(e) => handleWorkingHoursChange(key, 'open', e.target.value)}
                          className={`${inputBase} min-w-0 px-3 py-2.5 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400`}
                        />
                      </div>

                      <div className="order-4 min-w-0 md:order-3">
                        <label htmlFor={`${key}-close`} className="mb-1.5 block text-xs font-medium text-slate-500 md:sr-only">
                          Close Time
                        </label>
                        <input
                          type="time"
                          id={`${key}-close`}
                          value={day.close}
                          disabled={day.closed}
                          onChange={(e) => handleWorkingHoursChange(key, 'close', e.target.value)}
                          className={`${inputBase} min-w-0 px-3 py-2.5 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400`}
                        />
                      </div>
                    </div>
                  </div>
                )
              })}
              {fieldError('workingHours')}
            </div>

            <FormSubsectionHeading
              id="section-faqs"
              title="FAQs"
              description="Add optional question-and-answer pairs for common customer concerns."
              action={
                profileData.faqs.length < MAX_FAQS ? (
                  <button
                    type="button"
                    onClick={handleAddFaq}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-lg font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-200"
                    aria-label="Add FAQ item"
                  >
                    +
                  </button>
                ) : undefined
              }
            />

            <div className="space-y-4">
              {profileData.faqs.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-white/60 px-4 py-5 text-sm text-slate-500">
                  No FAQs added yet.
                </div>
              ) : (
                profileData.faqs.map((faq, index) => (
                  <div key={faq.id} className="rounded-2xl border border-slate-200 bg-white/85 p-4 sm:p-5">
                    <div className="mb-4 flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-slate-800">FAQ {index + 1}</p>
                      <button
                        type="button"
                        onClick={() => handleRemoveFaq(faq.id)}
                        className="inline-flex items-center justify-center rounded-full border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-medium text-rose-700 transition hover:bg-rose-100 focus:outline-none focus:ring-2 focus:ring-rose-200"
                      >
                        Remove
                      </button>
                    </div>

                    <div className="grid gap-4">
                      <div>
                        <label htmlFor={`faq-question-${faq.id}`} className={compactFieldLabelClass}>
                          Question
                        </label>
                        <input
                          type="text"
                          id={`faq-question-${faq.id}`}
                          value={faq.question}
                          onChange={(e) => handleFaqChange(faq.id, 'question', e.target.value)}
                          maxLength={FAQ_QUESTION_MAX_LENGTH}
                          placeholder="e.g. Do you offer home visits?"
                          aria-invalid={!!errors.faqs}
                          aria-describedby={
                            errors.faqs
                              ? `faqs-error faq-question-counter-${faq.id}`
                              : `faq-question-counter-${faq.id}`
                          }
                          className={`${inputBase} ${errors.faqs ? 'border-red-400 bg-red-50/60 focus:border-red-400 focus:ring-red-100' : ''}`}
                        />
                        {characterCounter(`faq-question-counter-${faq.id}`, faq.question, FAQ_QUESTION_MAX_LENGTH)}
                      </div>

                      <div>
                        <label htmlFor={`faq-answer-${faq.id}`} className={compactFieldLabelClass}>
                          Answer
                        </label>
                        <textarea
                          id={`faq-answer-${faq.id}`}
                          value={faq.answer}
                          onChange={(e) => handleFaqChange(faq.id, 'answer', e.target.value)}
                          maxLength={FAQ_ANSWER_MAX_LENGTH}
                          placeholder="Add the answer customers should see."
                          aria-invalid={!!errors.faqs}
                          aria-describedby={
                            errors.faqs
                              ? `faqs-error faq-answer-counter-${faq.id}`
                              : `faq-answer-counter-${faq.id}`
                          }
                          className={`${textareaBase} ${errors.faqs ? 'border-red-400 bg-red-50/60 focus:border-red-400 focus:ring-red-100' : ''}`}
                        />
                        {characterCounter(`faq-answer-counter-${faq.id}`, faq.answer, FAQ_ANSWER_MAX_LENGTH)}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
            {fieldError('faqs')}
            </div>
          </section>
          )}

          {currentStepIndex === 3 && (
          <section className={sectionCardClass} aria-labelledby="section-branding">
            <FormSectionHeading
              id="section-branding"
              title="Branding & Business Media"
              description="Upload the logo, banner, and gallery images that make your profile look trustworthy and complete."
            />
            <div className="space-y-5">
              <div className="rounded-2xl border border-slate-200 bg-white/85 p-4 sm:p-5">
                <label htmlFor="logo" className={labelClass}>
                  Business Logo
                  <span className={optionalTextClass}>Optional</span>
                </label>
                <input
                  ref={logoInputRef}
                  type="file"
                  id="logo"
                  name="logo"
                  accept={imageAccept}
                  onChange={handleLogoChange}
                  aria-invalid={!!errors.logo}
                  aria-describedby={errors.logo ? 'logo-error' : 'logo-help'}
                  className={`${fileInputBase} ${errors.logo ? 'border-red-400 bg-red-50/60 focus:border-red-400 focus:ring-red-100' : ''}`}
                />
                {fieldError('logo')}
                {logoFileName ? (
                  <p className="mt-2 flex items-center gap-1 text-xs text-slate-500">
                    <svg className="w-3.5 h-3.5 shrink-0 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    {logoFileName}
                  </p>
                ) : (
                  <p id="logo-help" className="mt-2 text-xs text-slate-400">
                    JPG, PNG, or WebP only. Maximum file size is 5 MB.
                  </p>
                )}
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white/85 p-4 sm:p-5">
                <label htmlFor="coverBanner" className={labelClass}>
                  Cover Banner
                  <span className={optionalTextClass}>Optional</span>
                </label>
                <input
                  ref={coverBannerInputRef}
                  type="file"
                  id="coverBanner"
                  name="coverBanner"
                  accept={imageAccept}
                  onChange={handleCoverBannerChange}
                  aria-invalid={!!errors.coverBanner}
                  aria-describedby={errors.coverBanner ? 'coverBanner-error' : 'coverBanner-help'}
                  className={`${fileInputBase} ${errors.coverBanner ? 'border-red-400 bg-red-50/60 focus:border-red-400 focus:ring-red-100' : ''}`}
                />
                {fieldError('coverBanner')}
                <p id="coverBanner-help" className="mt-2 text-xs text-slate-400">
                  Upload a wide banner image for the top of your public business profile. JPG, PNG, or WebP only. Maximum file size is 5 MB.
                </p>
                {coverBannerPreviewUrl && (
                  <div className="mt-4">
                    <img
                      src={coverBannerPreviewUrl}
                      alt="Selected cover banner preview"
                      className="aspect-[3/1] w-full rounded-2xl border border-slate-200 object-cover bg-slate-50"
                    />
                    <div className="mt-3 flex items-center justify-between gap-3">
                      <p className="truncate text-xs text-slate-500">
                        {coverBannerFileName || 'Current cover banner'}
                      </p>
                      <button
                        type="button"
                        onClick={handleClearCoverBanner}
                        className="inline-flex items-center justify-center rounded-full border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-medium text-rose-700 transition hover:bg-rose-100 focus:outline-none focus:ring-2 focus:ring-rose-200"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white/85 p-4 sm:p-5">
                <label htmlFor="galleryImages" className={labelClass}>
                  Business Gallery <span className="text-red-500" aria-hidden="true">*</span>
                </label>
                <input
                  ref={galleryInputRef}
                  type="file"
                  id="galleryImages"
                  name="galleryImages"
                  accept={imageAccept}
                  multiple
                  onChange={handleGalleryImagesChange}
                  aria-required="true"
                  aria-invalid={!!errors.galleryImages}
                  aria-describedby={errors.galleryImages ? 'galleryImages-error' : 'galleryImages-help'}
                  className={`${fileInputBase} ${errors.galleryImages ? 'border-red-400 bg-red-50/60 focus:border-red-400 focus:ring-red-100' : ''}`}
                />
                {fieldError('galleryImages')}
                <p id="galleryImages-help" className="mt-2 text-xs text-slate-400">
                  Upload photos of your shop, clinic, office, work, products, or services. Up to {MAX_GALLERY_IMAGES} images.
                </p>

                {(profileData.existingGalleryImageUrls.length > 0 || selectedGalleryPreviews.length > 0) && (
                  <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {profileData.existingGalleryImageUrls.map((url) => (
                      <div key={url} className="relative overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
                        <img
                          src={url}
                          alt="Saved gallery preview"
                          className="aspect-square w-full object-cover"
                        />
                        <button
                          type="button"
                          onClick={() => handleRemoveExistingGalleryImage(url)}
                          className="absolute right-2 top-2 rounded-full bg-white/95 px-2.5 py-1 text-xs font-medium text-rose-700 shadow-sm transition hover:bg-white focus:outline-none focus:ring-2 focus:ring-rose-200"
                        >
                          Remove
                        </button>
                      </div>
                    ))}

                    {selectedGalleryPreviews.map((preview, index) => (
                      <div key={preview.key} className="relative overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
                        <img
                          src={preview.url}
                          alt={`Selected gallery preview ${index + 1}`}
                          className="aspect-square w-full object-cover"
                        />
                        <button
                          type="button"
                          onClick={() => handleRemoveSelectedGalleryImage(index)}
                          className="absolute right-2 top-2 rounded-full bg-white/95 px-2.5 py-1 text-xs font-medium text-rose-700 shadow-sm transition hover:bg-white focus:outline-none focus:ring-2 focus:ring-rose-200"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </section>
          )}

          {currentStepIndex === 4 && (
          <section className={sectionCardClass} aria-labelledby="section-certificates-documents">
            <FormSectionHeading
              id="section-certificates-documents"
              title="Certificates & Documents"
              description="Add credentials and supporting files for your business profile."
            />
            <div className="space-y-5">
            <FormSubsectionHeading
              id="section-qualifications"
              title="Certificates / Licenses / Qualifications"
              description="Add optional credentials that strengthen trust in your business."
              action={
                profileData.qualifications.length < MAX_QUALIFICATIONS ? (
                  <button
                    type="button"
                    onClick={handleAddQualification}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-lg font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-200"
                    aria-label="Add certificate, license, or qualification"
                  >
                    +
                  </button>
                ) : undefined
              }
            />

            <div className="space-y-4">
              {profileData.qualifications.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-white/60 px-4 py-5 text-sm text-slate-500">
                  No credentials added yet.
                </div>
              ) : (
                profileData.qualifications.map((item, index) => (
                  <div key={item.id} className="rounded-2xl border border-slate-200 bg-white/85 p-4 sm:p-5">
                    <div className="mb-4 flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-slate-800">Credential {index + 1}</p>
                      <button
                        type="button"
                        onClick={() => handleRemoveQualification(item.id)}
                        className="inline-flex items-center justify-center rounded-full border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-medium text-rose-700 transition hover:bg-rose-100 focus:outline-none focus:ring-2 focus:ring-rose-200"
                      >
                        Remove
                      </button>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="md:col-span-2">
                        <label htmlFor={`qualification-title-${item.id}`} className={compactFieldLabelClass}>
                          Certificate / License / Qualification Name
                        </label>
                        <input
                          type="text"
                          id={`qualification-title-${item.id}`}
                          value={item.title}
                          onChange={(e) => handleQualificationChange(item.id, 'title', e.target.value)}
                          maxLength={QUALIFICATION_TITLE_MAX_LENGTH}
                          placeholder="e.g. Medical License, ISO Certificate, Professional Qualification"
                          aria-invalid={!!errors.qualifications}
                          aria-describedby={
                            errors.qualifications
                              ? `qualifications-error qualification-title-counter-${item.id}`
                              : `qualification-title-counter-${item.id}`
                          }
                          className={`${inputBase} ${errors.qualifications ? 'border-red-400 bg-red-50/60 focus:border-red-400 focus:ring-red-100' : ''}`}
                        />
                        {characterCounter(`qualification-title-counter-${item.id}`, item.title, QUALIFICATION_TITLE_MAX_LENGTH)}
                      </div>

                      <div>
                        <label htmlFor={`qualification-organization-${item.id}`} className={compactFieldLabelClass}>
                          Issuing Organization
                          <span className={optionalTextClass}>Optional</span>
                        </label>
                        <input
                          type="text"
                          id={`qualification-organization-${item.id}`}
                          value={item.issuingOrganization}
                          onChange={(e) => handleQualificationChange(item.id, 'issuingOrganization', e.target.value)}
                          maxLength={QUALIFICATION_ISSUING_ORGANIZATION_MAX_LENGTH}
                          placeholder="e.g. State Licensing Board"
                          aria-invalid={!!errors.qualifications}
                          aria-describedby={
                            errors.qualifications
                              ? `qualifications-error qualification-organization-counter-${item.id}`
                              : `qualification-organization-counter-${item.id}`
                          }
                          className={`${inputBase} ${errors.qualifications ? 'border-red-400 bg-red-50/60 focus:border-red-400 focus:ring-red-100' : ''}`}
                        />
                        {characterCounter(
                          `qualification-organization-counter-${item.id}`,
                          item.issuingOrganization,
                          QUALIFICATION_ISSUING_ORGANIZATION_MAX_LENGTH
                        )}
                      </div>

                      <div>
                        <label htmlFor={`qualification-year-${item.id}`} className={compactFieldLabelClass}>
                          Year
                          <span className={optionalTextClass}>Optional</span>
                        </label>
                        <input
                          type="number"
                          id={`qualification-year-${item.id}`}
                          value={item.year}
                          onChange={(e) => handleQualificationChange(item.id, 'year', e.target.value)}
                          placeholder="e.g. 2022"
                          min="1000"
                          max={getCurrentYear()}
                          aria-invalid={!!errors.qualifications}
                          aria-describedby={errors.qualifications ? 'qualifications-error' : undefined}
                          className={`${inputBase} ${errors.qualifications ? 'border-red-400 bg-red-50/60 focus:border-red-400 focus:ring-red-100' : ''}`}
                        />
                      </div>

                      <div className="md:col-span-2">
                        <label htmlFor={`qualification-description-${item.id}`} className={compactFieldLabelClass}>
                          Description
                          <span className={optionalTextClass}>Optional</span>
                        </label>
                        <textarea
                          id={`qualification-description-${item.id}`}
                          value={item.description}
                          onChange={(e) => handleQualificationChange(item.id, 'description', e.target.value)}
                          maxLength={QUALIFICATION_DESCRIPTION_MAX_LENGTH}
                          placeholder="Add any supporting detail customers should know."
                          aria-invalid={!!errors.qualifications}
                          aria-describedby={
                            errors.qualifications
                              ? `qualifications-error qualification-description-counter-${item.id}`
                              : `qualification-description-counter-${item.id}`
                          }
                          className={`${textareaBase} ${errors.qualifications ? 'border-red-400 bg-red-50/60 focus:border-red-400 focus:ring-red-100' : ''}`}
                        />
                        {characterCounter(
                          `qualification-description-counter-${item.id}`,
                          item.description,
                          QUALIFICATION_DESCRIPTION_MAX_LENGTH
                        )}
                      </div>

                      <div className="md:col-span-2">
                        <label htmlFor={`qualification-document-${item.id}`} className={compactFieldLabelClass}>
                          Upload Document
                          <span className={optionalTextClass}>Optional</span>
                        </label>
                        <input
                          type="file"
                          id={`qualification-document-${item.id}`}
                          accept={documentAccept}
                          onChange={(e) => handleQualificationDocumentChange(item.id, e)}
                          aria-invalid={!!errors.qualifications}
                          aria-describedby={errors.qualifications ? 'qualifications-error' : undefined}
                          className={`${fileInputBase} ${errors.qualifications ? 'border-red-400 bg-red-50/60 focus:border-red-400 focus:ring-red-100' : ''}`}
                        />
                        <p className="mt-2 text-xs text-slate-400">
                          Supported formats: PDF, JPG, PNG, and WebP. Maximum file size is 10 MB.
                        </p>

                        {(item.documentFile || item.documentFileName.trim()) && (
                          <div className="mt-3 flex flex-col gap-3 rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium text-slate-800">
                                {item.documentFile?.name || item.documentFileName}
                              </p>
                              <p className="mt-1 text-xs text-slate-500">
                                {formatMimeTypeLabel(item.documentFile?.type || item.documentMimeType)}
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleRemoveQualificationDocument(item.id)}
                              className="inline-flex items-center justify-center rounded-full border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-medium text-rose-700 transition hover:bg-rose-100 focus:outline-none focus:ring-2 focus:ring-rose-200"
                            >
                              Remove
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
            {fieldError('qualifications')}

            <FormSubsectionHeading
              id="section-documents"
              title="Optional Documents"
              description="Upload brochures, menus, certificates, licenses, rate cards, or similar supporting documents."
            />

            <div className="rounded-2xl border border-slate-200 bg-white/85 p-4 sm:p-5">
              <div className="mb-5">
                <label htmlFor="documentName" className={labelClass}>
                  Document Name
                  <span className={optionalTextClass}>Optional</span>
                </label>
                <input
                  type="text"
                  id="documentName"
                  name="documentName"
                  value={profileData.documentName}
                  onChange={handleChange}
                  maxLength={DOCUMENT_NAME_MAX_LENGTH}
                  placeholder="e.g. Business Brochure, Menu, Rate Card, Registration Certificate"
                  aria-invalid={!!errors.documentName}
                  aria-describedby={
                    errors.documentName
                      ? 'documentName-error documentName-counter'
                      : 'documentName-counter'
                  }
                  className={`${inputBase} ${errors.documentName ? 'border-red-400 bg-red-50/60 focus:border-red-400 focus:ring-red-100' : ''}`}
                />
                {fieldError('documentName')}
                {characterCounter('documentName-counter', profileData.documentName, DOCUMENT_NAME_MAX_LENGTH)}
              </div>

              <label htmlFor="documents" className={labelClass}>
                Upload Documents
                <span className={optionalTextClass}>Optional</span>
              </label>
              <input
                ref={documentInputRef}
                type="file"
                id="documents"
                name="documents"
                accept={documentAccept}
                multiple
                onChange={handleDocumentFilesChange}
                aria-invalid={!!errors.documents}
                aria-describedby={errors.documents ? 'documents-error' : 'documents-help'}
                className={`${fileInputBase} ${errors.documents ? 'border-red-400 bg-red-50/60 focus:border-red-400 focus:ring-red-100' : ''}`}
              />
              {fieldError('documents')}
              <p id="documents-help" className="mt-2 text-xs text-slate-400">
                Supported formats: PDF, JPG, PNG, and WebP. Maximum file size is 10 MB per file.
              </p>

              {(profileData.existingDocuments.length > 0 || profileData.documentFiles.length > 0) && (
                <div className="mt-4 space-y-3">
                  {profileData.existingDocuments.map((document) => (
                    <div
                      key={document.id}
                      className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-slate-800">
                          {document.document_name || document.file_name}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">{formatMimeTypeLabel(document.mime_type)}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveExistingDocument(document.id)}
                        className="inline-flex items-center justify-center rounded-full border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-medium text-rose-700 transition hover:bg-rose-100 focus:outline-none focus:ring-2 focus:ring-rose-200"
                      >
                        Remove
                      </button>
                    </div>
                  ))}

                  {profileData.documentFiles.map((file, index) => (
                    <div
                      key={`${file.name}-${file.lastModified}-${index}`}
                      className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-slate-800">
                          {profileData.documentName.trim() || file.name}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">{formatMimeTypeLabel(file.type)}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemovePendingDocument(index)}
                        className="inline-flex items-center justify-center rounded-full border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-medium text-rose-700 transition hover:bg-rose-100 focus:outline-none focus:ring-2 focus:ring-rose-200"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            </div>
          </section>
          )}

          </div>

          {/* -- Buttons -- */}
          {!isLastStep && (
            <div className="rounded-[26px] border border-slate-200/90 bg-slate-50/90 p-4 sm:p-5">
              <div className={`flex items-center ${isFirstStep ? 'justify-end' : 'justify-between'}`}>
                {!isFirstStep && (
                  <button
                    type="button"
                    onClick={handlePreviousStep}
                    className="inline-flex items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#0f172a_0%,#1d4ed8_58%,#2563eb_100%)] px-8 py-3 text-sm font-semibold text-white shadow-[0_20px_40px_-24px_rgba(37,99,235,0.75)] transition hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-sky-300 focus:ring-offset-2 focus:ring-offset-slate-50"
                  >
                    Previous
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleNextStep}
                  className="inline-flex items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#0f172a_0%,#1d4ed8_58%,#2563eb_100%)] px-8 py-3 text-sm font-semibold text-white shadow-[0_20px_40px_-24px_rgba(37,99,235,0.75)] transition hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-sky-300 focus:ring-offset-2 focus:ring-offset-slate-50"
                >
                  Next
                </button>
              </div>
            </div>
          )}

          {isLastStep && (
            <div className="rounded-[26px] border border-slate-200/90 bg-slate-50/90 p-4 sm:p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                  <button
                    type="button"
                    onClick={handlePreviousStep}
                    className="inline-flex w-full items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#0f172a_0%,#1d4ed8_58%,#2563eb_100%)] px-8 py-3 text-sm font-semibold text-white shadow-[0_20px_40px_-24px_rgba(37,99,235,0.75)] transition hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-sky-300 focus:ring-offset-2 focus:ring-offset-slate-50 sm:w-auto"
                  >
                    Previous
                  </button>
                  <div>
                    <p className="text-sm font-semibold text-slate-900">
                      {isEditMode ? 'Review your updates before saving.' : 'Review your details before continuing.'}
                    </p>
                    <p className="mt-1 text-sm leading-6 text-slate-500">
                      {isEditMode
                        ? 'Your existing business profile will be updated with these changes.'
                        : 'You can preview the public profile before creating it.'}
                    </p>
                  </div>
                </div>

              <div className="flex flex-col gap-3 sm:flex-row lg:shrink-0">
                <button
                  type="button"
                  onClick={handleClearForm}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-6 py-3 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-slate-200 sm:w-auto"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  Clear Form
                </button>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  aria-busy={isSubmitting}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[linear-gradient(135deg,#0f172a_0%,#1d4ed8_58%,#2563eb_100%)] px-8 py-3 text-sm font-semibold text-white shadow-[0_20px_40px_-24px_rgba(37,99,235,0.75)] transition hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-sky-300 focus:ring-offset-2 focus:ring-offset-slate-50 disabled:cursor-not-allowed disabled:opacity-70 sm:w-auto"
                >
                  {isSubmitting ? (
                    <>
                      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Loading...
                    </>
                  ) : (
                    <>
                      {isEditMode ? 'Save Changes' : 'Preview Profile'}
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
          )}

              </form>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}

export default CreateProfilePage
