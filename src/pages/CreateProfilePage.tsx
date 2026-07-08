import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  createDefaultSocialLinks,
  useProfile,
  workingDays,
  type WorkingDayKey,
} from '../context/ProfileContext.tsx'
import { useAuth } from '../context/AuthContext.tsx'
import { updateBusinessProfile } from '../lib/businessProfileService.ts'
import { validateImageFile } from '../lib/storageService.ts'
import { usePageMeta } from '../hooks/usePageMeta.ts'
import { ToastContainer, type ToastItem, type ToastType } from '../components/Toast.tsx'
import { getActiveMode } from '../utils/activeMode.ts'
import AppHeader from '../components/AppHeader.tsx'

interface FormErrors {
  businessName?: string
  ownerName?: string
  businessCategory?: string
  phoneNumber?: string
  email?: string
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
const imageAccept = 'image/jpeg,image/png,image/webp'

const categories = [
  'Retail',
  'Food & Beverage',
  'Technology',
  'Health & Wellness',
  'Education',
  'Professional Services',
  'Other',
]

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

function parseKeywords(text: string): string[] {
  const seen = new Set<string>()
  const keywords: string[] = []

  for (const value of text.split(',')) {
    const keyword = value.trim()
    const key = keyword.toLowerCase()
    if (!keyword || seen.has(key)) continue

    seen.add(key)
    keywords.push(keyword)
  }

  return keywords
}

function validateSelectedImage(file: File): string | null {
  const validation = validateImageFile(file)
  return validation.valid ? null : validation.error || 'Invalid image file.'
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
  const defaultPlatforms = ['Instagram', 'Facebook']
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

interface FormSectionHeadingProps {
  id: string
  title: string
  description: string
  action?: React.ReactNode
}

function FormSectionHeading({ id, title, description, action }: FormSectionHeadingProps) {
  return (
    <div className="mb-6 border-b border-slate-200/80 pb-4">
      <span
        aria-hidden="true"
        className="block h-1 w-14 rounded-full bg-[linear-gradient(90deg,#0f172a_0%,#2563eb_58%,#38bdf8_100%)]"
      />
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

function CreateProfilePage() {
  const navigate = useNavigate()
  const { profileData, setProfileData, clearProfile } = useProfile()
  const { user } = useAuth()
  const activeMode = getActiveMode()

  usePageMeta({
    title: 'Create Business Profile | Smart Business Profile',
    description: 'Create a professional business profile with contact details, QR code, and public sharing link.',
  })

  const isEditMode = Boolean(profileData.id)
  const isForbidden =
    isEditMode && Boolean(profileData.ownerId) && profileData.ownerId !== user?.id

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
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const logoInputRef = useRef<HTMLInputElement>(null)
  const coverBannerInputRef = useRef<HTMLInputElement>(null)
  const galleryInputRef = useRef<HTMLInputElement>(null)

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
    setProfileData({ ...profileData, [name]: value })
    if (errors[name as keyof FormErrors]) {
      setErrors((prev) => ({ ...prev, [name]: undefined }))
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

  const validate = (): boolean => {
    const newErrors: FormErrors = {}
    if (!profileData.businessName.trim()) {
      newErrors.businessName = 'Business name is required.'
    }
    if (!profileData.ownerName.trim()) {
      newErrors.ownerName = 'Owner name is required.'
    }
    if (!profileData.businessCategory) {
      newErrors.businessCategory = 'Please select a category.'
    }
    if (!profileData.phoneNumber.trim()) {
      newErrors.phoneNumber = 'Phone number is required.'
    }
    if (!profileData.email.trim()) {
      newErrors.email = 'Email address is required.'
    }
    if (profileData.tagline.trim().length > 120) {
      newErrors.tagline = 'Tagline must be 120 characters or fewer.'
    }
    if (!isValidOptionalUrl(profileData.googleMapsUrl)) {
      newErrors.googleMapsUrl = 'Enter a valid Google Maps URL.'
    }
    const keywords = parseKeywords(profileData.keywordsText)
    if (keywords.length > 20) {
      newErrors.keywordsText = 'Use 20 keywords or fewer.'
    } else if (keywords.some((keyword) => keyword.length > 40)) {
      newErrors.keywordsText = 'Each keyword must be 40 characters or fewer.'
    }
    const hasIncompleteHours = workingDays.some(({ key }) => {
      const day = profileData.workingHours[key]
      if (day.closed) return false
      const hasOpen = day.open.trim().length > 0
      const hasClose = day.close.trim().length > 0
      return hasOpen !== hasClose
    })
    if (hasIncompleteHours) {
      newErrors.workingHours = 'Provide both open and close times, or mark the day closed.'
    }

    const nextSocialLinkRowErrors = validateSocialLinkRows(socialLinkRows)

    setSocialLinkRowErrors(nextSocialLinkRowErrors)
    setErrors(newErrors)

    return Object.keys(newErrors).length === 0 && Object.keys(nextSocialLinkRowErrors).length === 0
  }

  const handleContinue = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    const isValid = validate()
    if (!isValid) {
      setIsSubmitting(false)
      const firstErrorField = document.querySelector('[aria-invalid="true"]') as HTMLElement | null
      firstErrorField?.focus()
      return
    }

    if (!isEditMode) {
      navigate('/profile-preview')
      return
    }

    try {
      const updated = await updateBusinessProfile(profileData.id as string, profileData)
      setProfileData({
        ...profileData,
        businessName: updated.business_name,
        ownerName: updated.owner_name,
        businessCategory: updated.business_category,
        phoneNumber: updated.phone_number,
        whatsappNumber: updated.whatsapp_number || '',
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
      })
      navigate(activeMode === 'business' ? '/business-home' : '/dashboard', {
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
    clearProfile()
    setErrors({})
    setSocialLinkRowErrors({})
    setSocialLinkRows(createSocialLinkRows(createDefaultSocialLinks()))
    setLogoFileName('')
    setCoverBannerFileName('')
    if (logoInputRef.current) {
      logoInputRef.current.value = ''
    }
    if (coverBannerInputRef.current) {
      coverBannerInputRef.current.value = ''
    }
    if (galleryInputRef.current) {
      galleryInputRef.current.value = ''
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

          {/* ── Basic Information ── */}
          <section className={sectionCardClass} aria-labelledby="section-basic">
            <FormSectionHeading
              id="section-basic"
              title="Basic Business Information"
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
                  placeholder="e.g. Sunrise Bakery"
                  autoComplete="organization"
                  aria-required="true"
                  aria-invalid={!!errors.businessName}
                  aria-describedby={errors.businessName ? 'businessName-error' : undefined}
                  className={`${inputBase} ${errors.businessName ? 'border-red-400 bg-red-50/60 focus:border-red-400 focus:ring-red-100' : ''}`}
                />
                {fieldError('businessName')}
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
                  placeholder="e.g. Sarah Johnson"
                  autoComplete="name"
                  aria-required="true"
                  aria-invalid={!!errors.ownerName}
                  aria-describedby={errors.ownerName ? 'ownerName-error' : undefined}
                  className={`${inputBase} ${errors.ownerName ? 'border-red-400 bg-red-50/60 focus:border-red-400 focus:ring-red-100' : ''}`}
                />
                {fieldError('ownerName')}
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
                  {categories.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
                {fieldError('businessCategory')}
              </div>
            </div>
          </section>

          {/* ── Contact Information ── */}
          <section className={sectionCardClass} aria-labelledby="section-contact">
            <FormSectionHeading
              id="section-contact"
              title="Contact Information"
              description="Add contact options customers can use to reach you."
            />
            <div className="grid gap-5 md:grid-cols-2">

              <div>
                <label htmlFor="phoneNumber" className={labelClass}>
                  Phone Number <span className="text-red-500" aria-hidden="true">*</span>
                </label>
                <input
                  type="tel"
                  id="phoneNumber"
                  name="phoneNumber"
                  value={profileData.phoneNumber}
                  onChange={handleChange}
                  placeholder="e.g. +1 555 000 1234"
                  autoComplete="tel"
                  aria-required="true"
                  aria-invalid={!!errors.phoneNumber}
                  aria-describedby={errors.phoneNumber ? 'phoneNumber-error' : undefined}
                  className={`${inputBase} ${errors.phoneNumber ? 'border-red-400 bg-red-50/60 focus:border-red-400 focus:ring-red-100' : ''}`}
                />
                {fieldError('phoneNumber')}
              </div>

              <div>
                <label htmlFor="whatsappNumber" className={labelClass}>
                  WhatsApp Number
                  <span className={optionalTextClass}>Optional</span>
                </label>
                <input
                  type="tel"
                  id="whatsappNumber"
                  name="whatsappNumber"
                  value={profileData.whatsappNumber}
                  onChange={handleChange}
                  placeholder="e.g. +1 555 000 5678"
                  autoComplete="tel"
                  className={inputBase}
                />
                <p className="mt-2 text-xs text-slate-400">Leave blank to use your phone number for WhatsApp.</p>
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
          </section>

          {/* ── Business Information ── */}
          <section className={sectionCardClass} aria-labelledby="section-business">
            <FormSectionHeading
              id="section-business"
              title="Business Information"
              description="Describe your business in a clear, professional way."
            />
            <div className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
              <div className="space-y-5">
                <div>
                  <label htmlFor="address" className={labelClass}>
                    Address
                    <span className={optionalTextClass}>Optional</span>
                  </label>
                  <textarea
                    id="address"
                    name="address"
                    rows={3}
                    value={profileData.address}
                    onChange={handleChange}
                    placeholder="e.g. 123 Main Street, Suite 4&#10;New York, NY 10001"
                    className={textareaBase}
                  />
                </div>

                <div>
                  <label htmlFor="googleMapsUrl" className={labelClass}>
                    Google Maps Link
                    <span className={optionalTextClass}>Optional</span>
                  </label>
                  <input
                    type="url"
                    id="googleMapsUrl"
                    name="googleMapsUrl"
                    value={profileData.googleMapsUrl}
                    onChange={handleChange}
                    placeholder="https://maps.google.com/..."
                    aria-invalid={!!errors.googleMapsUrl}
                    aria-describedby={errors.googleMapsUrl ? 'googleMapsUrl-error' : undefined}
                    className={`${inputBase} ${errors.googleMapsUrl ? 'border-red-400 bg-red-50/60 focus:border-red-400 focus:ring-red-100' : ''}`}
                  />
                  {fieldError('googleMapsUrl')}
                </div>
              </div>

              <div>
                <label htmlFor="aboutBusiness" className={labelClass}>
                  About Business
                  <span className={optionalTextClass}>Optional</span>
                </label>
                <textarea
                  id="aboutBusiness"
                  name="aboutBusiness"
                  rows={4}
                  value={profileData.aboutBusiness}
                  onChange={handleChange}
                  placeholder="A short description of your business, what you offer, and what makes you unique..."
                  className={`${textareaBase} min-h-[124px]`}
                />
              </div>
            </div>
          </section>

          <section className={sectionCardClass} aria-labelledby="section-enrichment">
            <FormSectionHeading
              id="section-enrichment"
              title="Services & Keywords"
              description="Show what you offer and improve how customers discover your profile."
            />
            <div className="space-y-5">
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
                  maxLength={120}
                  placeholder="Example: Trusted local dental care for your family"
                  aria-invalid={!!errors.tagline}
                  aria-describedby={errors.tagline ? 'tagline-error' : 'tagline-help'}
                  className={`${inputBase} ${errors.tagline ? 'border-red-400 bg-red-50/60 focus:border-red-400 focus:ring-red-100' : ''}`}
                />
                {fieldError('tagline')}
                <p id="tagline-help" className="mt-2 text-xs text-slate-400">
                  This appears under the business name on the public profile.
                </p>
              </div>

              <div className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
                <div>
                  <label htmlFor="servicesText" className={labelClass}>
                    Services
                    <span className={optionalTextClass}>Optional</span>
                  </label>
                  <textarea
                    id="servicesText"
                    name="servicesText"
                    rows={4}
                    value={profileData.servicesText}
                    onChange={handleChange}
                    placeholder={'Dental Checkup\nTeeth Cleaning\nRoot Canal Treatment'}
                    className={`${textareaBase} min-h-[148px]`}
                  />
                  <p className="mt-2 text-xs text-slate-400">Enter one service per line.</p>
                </div>

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
                    placeholder="dentist, root canal, dental clinic, teeth cleaning"
                    aria-invalid={!!errors.keywordsText}
                    aria-describedby={errors.keywordsText ? 'keywordsText-error' : 'keywordsText-help'}
                    className={`${textareaBase} min-h-[132px] ${errors.keywordsText ? 'border-red-400 bg-red-50/60 focus:border-red-400 focus:ring-red-100' : ''}`}
                  />
                  {fieldError('keywordsText')}
                  <p id="keywordsText-help" className="mt-2 text-xs text-slate-400">
                    Separate keywords with commas. Use up to 20 keywords, 40 characters each.
                  </p>
                </div>
              </div>
            </div>
          </section>

          <section className={sectionCardClass} aria-labelledby="section-hours">
            <FormSectionHeading
              id="section-hours"
              title="Working Hours"
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
          </section>

          <section className={sectionCardClass} aria-labelledby="section-online">
            <FormSectionHeading
              id="section-online"
              title="Social Links"
              description="Add your official social profiles. Start with Instagram and Facebook, then add more platforms if needed."
              action={
                <button
                  type="button"
                  onClick={handleAddSocialLinkRow}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-lg font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-200"
                  aria-label="Add social link"
                >
                  +
                </button>
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
          </section>

          <section className={sectionCardClass} aria-labelledby="section-visibility">
            <FormSectionHeading
              id="section-visibility"
              title="Visibility"
              description="Control whether your profile appears publicly in the directory."
            />
            <div className="rounded-2xl border border-slate-200 bg-white/85 p-4 sm:p-5">
              <label htmlFor="isPublic" className={labelClass}>
                Profile Visibility
              </label>
              <select
                id="isPublic"
                value={profileData.isPublic ? 'public' : 'private'}
                onChange={(e) => setProfileData({ ...profileData, isPublic: e.target.value === 'public' })}
                className={`${inputBase} bg-white`}
              >
                <option value="public">Public</option>
                <option value="private">Private</option>
              </select>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                Public profiles can appear in the directory. Private profiles stay hidden from public visitors.
              </p>
            </div>
          </section>

          <section className={sectionCardClass} aria-labelledby="section-branding">
            <FormSectionHeading
              id="section-branding"
              title="Profile Images & Gallery"
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
                  Business Gallery
                  <span className={optionalTextClass}>Optional</span>
                </label>
                <input
                  ref={galleryInputRef}
                  type="file"
                  id="galleryImages"
                  name="galleryImages"
                  accept={imageAccept}
                  multiple
                  onChange={handleGalleryImagesChange}
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

          {/* ── Buttons ── */}
          <div className="rounded-[26px] border border-slate-200/90 bg-slate-50/90 p-4 sm:p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
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

              </form>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}

export default CreateProfilePage
