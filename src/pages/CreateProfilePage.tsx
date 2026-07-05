import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  socialLinkFields,
  useProfile,
  workingDays,
  type SocialLinkKey,
  type WorkingDayKey,
} from '../context/ProfileContext.tsx'
import { useAuth } from '../context/AuthContext.tsx'
import { updateBusinessProfile } from '../lib/businessProfileService.ts'
import { validateImageFile } from '../lib/storageService.ts'
import { usePageMeta } from '../hooks/usePageMeta.ts'
import { ToastContainer, type ToastItem, type ToastType } from '../components/Toast.tsx'
import AppHeader from '../components/AppHeader.tsx'

interface FormErrors {
  businessName?: string
  ownerName?: string
  businessCategory?: string
  phoneNumber?: string
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

function CreateProfilePage() {
  const navigate = useNavigate()
  const { profileData, setProfileData, clearProfile } = useProfile()
  const { user } = useAuth()

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

  const handleSocialLinkChange = (key: SocialLinkKey, value: string) => {
    setProfileData({
      ...profileData,
      socialLinks: {
        ...profileData.socialLinks,
        [key]: value,
      },
    })
    if (errors[key]) {
      setErrors((prev) => ({ ...prev, [key]: undefined }))
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
    if (profileData.tagline.trim().length > 120) {
      newErrors.tagline = 'Tagline must be 120 characters or fewer.'
    }
    if (!isValidOptionalUrl(profileData.googleMapsUrl)) {
      newErrors.googleMapsUrl = 'Enter a valid Google Maps URL.'
    }
    for (const { key, label } of socialLinkFields) {
      if (!isValidOptionalUrl(profileData.socialLinks[key])) {
        newErrors[key] = `Enter a valid ${label} URL.`
      }
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
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
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
      navigate('/dashboard', { state: { profileUpdated: true } })
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
    'w-full px-4 py-2.5 border rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors text-sm'

  const fieldError = (key: keyof FormErrors) =>
    errors[key] ? (
      <p
        id={`${key}-error`}
        role="alert"
        className="mt-1.5 text-xs text-red-600 flex items-center gap-1"
      >
        <svg className="w-3 h-3 shrink-0" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
        </svg>
        {errors[key]}
      </p>
    ) : null

  const sectionHeading = 'text-xs font-semibold uppercase tracking-widest text-gray-400 mb-4 pb-2 border-b border-gray-100'

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
    <div className="min-h-screen bg-gradient-to-b from-white to-slate-50">
      <AppHeader />

      <main className="max-w-2xl mx-auto px-4 py-10">
        <ToastContainer toasts={toasts} />
        <div className="mb-8">
          <span
            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold mb-2 ${
              isEditMode ? 'bg-amber-50 text-amber-700' : 'bg-blue-50 text-blue-700'
            }`}
          >
            {isEditMode ? 'Edit Mode' : 'Create Mode'}
          </span>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight mb-1.5">
            {isEditMode ? 'Edit Your Profile' : 'Create Your Profile'}
          </h1>
          <p className="text-sm text-gray-500">
            Fields marked with <span className="text-red-500 font-medium">*</span> are required.
          </p>
        </div>

        <form onSubmit={handleContinue} noValidate className="space-y-10">

          {/* ── Basic Information ── */}
          <section aria-labelledby="section-basic">
            <h2 id="section-basic" className={sectionHeading}>
              Basic Business Information
            </h2>
            <div className="space-y-5">

              <div>
                <label htmlFor="businessName" className="block text-sm font-medium text-gray-700 mb-1.5">
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
                  className={`${inputBase} ${errors.businessName ? 'border-red-400 bg-red-50/30 focus:ring-red-400' : 'border-gray-300'}`}
                />
                {fieldError('businessName')}
              </div>

              <div>
                <label htmlFor="ownerName" className="block text-sm font-medium text-gray-700 mb-1.5">
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
                  className={`${inputBase} ${errors.ownerName ? 'border-red-400 bg-red-50/30 focus:ring-red-400' : 'border-gray-300'}`}
                />
                {fieldError('ownerName')}
              </div>

              <div>
                <label htmlFor="businessCategory" className="block text-sm font-medium text-gray-700 mb-1.5">
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
                  className={`${inputBase} bg-white ${errors.businessCategory ? 'border-red-400 bg-red-50/30 focus:ring-red-400' : 'border-gray-300'}`}
                >
                  <option value="">Select a category</option>
                  {categories.map((cat) => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
                {fieldError('businessCategory')}
              </div>

            </div>
          </section>

          {/* ── Contact Information ── */}
          <section aria-labelledby="section-contact">
            <h2 id="section-contact" className={sectionHeading}>
              Contact Information
            </h2>
            <div className="space-y-5">

              <div>
                <label htmlFor="phoneNumber" className="block text-sm font-medium text-gray-700 mb-1.5">
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
                  className={`${inputBase} ${errors.phoneNumber ? 'border-red-400 bg-red-50/30 focus:ring-red-400' : 'border-gray-300'}`}
                />
                {fieldError('phoneNumber')}
              </div>

              <div>
                <label htmlFor="whatsappNumber" className="block text-sm font-medium text-gray-700 mb-1.5">
                  WhatsApp Number
                  <span className="ml-2 text-xs text-gray-400 font-normal">Optional</span>
                </label>
                <input
                  type="tel"
                  id="whatsappNumber"
                  name="whatsappNumber"
                  value={profileData.whatsappNumber}
                  onChange={handleChange}
                  placeholder="e.g. +1 555 000 5678"
                  autoComplete="tel"
                  className={`${inputBase} border-gray-300`}
                />
                <p className="mt-1.5 text-xs text-gray-400">Leave blank to use your phone number for WhatsApp.</p>
              </div>

              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1.5">
                  Email Address
                  <span className="ml-2 text-xs text-gray-400 font-normal">Optional</span>
                </label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={profileData.email}
                  onChange={handleChange}
                  placeholder="e.g. hello@yourbusiness.com"
                  autoComplete="email"
                  className={`${inputBase} border-gray-300`}
                />
              </div>

              <div>
                <label htmlFor="website" className="block text-sm font-medium text-gray-700 mb-1.5">
                  Website
                  <span className="ml-2 text-xs text-gray-400 font-normal">Optional</span>
                </label>
                <input
                  type="url"
                  id="website"
                  name="website"
                  value={profileData.website}
                  onChange={handleChange}
                  placeholder="e.g. https://yourbusiness.com"
                  autoComplete="url"
                  className={`${inputBase} border-gray-300`}
                />
              </div>

            </div>
          </section>

          {/* ── Business Information ── */}
          <section aria-labelledby="section-business">
            <h2 id="section-business" className={sectionHeading}>
              Business Information
            </h2>
            <div className="space-y-5">

              <div>
                <label htmlFor="address" className="block text-sm font-medium text-gray-700 mb-1.5">
                  Address
                  <span className="ml-2 text-xs text-gray-400 font-normal">Optional</span>
                </label>
                <textarea
                  id="address"
                  name="address"
                  rows={3}
                  value={profileData.address}
                  onChange={handleChange}
                  placeholder="e.g. 123 Main Street, Suite 4&#10;New York, NY 10001"
                  className={`${inputBase} border-gray-300 resize-none`}
                />
              </div>

              <div>
                <label htmlFor="aboutBusiness" className="block text-sm font-medium text-gray-700 mb-1.5">
                  About Business
                  <span className="ml-2 text-xs text-gray-400 font-normal">Optional</span>
                </label>
                <textarea
                  id="aboutBusiness"
                  name="aboutBusiness"
                  rows={4}
                  value={profileData.aboutBusiness}
                  onChange={handleChange}
                  placeholder="A short description of your business, what you offer, and what makes you unique..."
                  className={`${inputBase} border-gray-300 resize-none`}
                />
              </div>

            </div>
          </section>

          {/* Profile Enrichment */}
          <section aria-labelledby="section-enrichment">
            <h2 id="section-enrichment" className={sectionHeading}>
              Profile Enrichment
            </h2>
            <div className="space-y-5">
              <div>
                <label htmlFor="tagline" className="block text-sm font-medium text-gray-700 mb-1.5">
                  Business Tagline
                  <span className="ml-2 text-xs text-gray-400 font-normal">Optional</span>
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
                  className={`${inputBase} ${errors.tagline ? 'border-red-400 bg-red-50/30 focus:ring-red-400' : 'border-gray-300'}`}
                />
                {fieldError('tagline')}
                <p id="tagline-help" className="mt-1.5 text-xs text-gray-400">
                  This appears under the business name on the public profile.
                </p>
              </div>

              <div>
                <label htmlFor="servicesText" className="block text-sm font-medium text-gray-700 mb-1.5">
                  Services
                  <span className="ml-2 text-xs text-gray-400 font-normal">Optional</span>
                </label>
                <textarea
                  id="servicesText"
                  name="servicesText"
                  rows={4}
                  value={profileData.servicesText}
                  onChange={handleChange}
                  placeholder={'Dental Checkup\nTeeth Cleaning\nRoot Canal Treatment'}
                  className={`${inputBase} border-gray-300 resize-none`}
                />
                <p className="mt-1.5 text-xs text-gray-400">Enter one service per line.</p>
              </div>

              <div>
                <label htmlFor="keywordsText" className="block text-sm font-medium text-gray-700 mb-1.5">
                  Business Keywords / Tags
                  <span className="ml-2 text-xs text-gray-400 font-normal">Optional</span>
                </label>
                <textarea
                  id="keywordsText"
                  name="keywordsText"
                  rows={3}
                  value={profileData.keywordsText}
                  onChange={handleChange}
                  placeholder="dentist, root canal, dental clinic, teeth cleaning"
                  aria-invalid={!!errors.keywordsText}
                  aria-describedby={errors.keywordsText ? 'keywordsText-error' : 'keywordsText-help'}
                  className={`${inputBase} ${errors.keywordsText ? 'border-red-400 bg-red-50/30 focus:ring-red-400' : 'border-gray-300'} resize-none`}
                />
                {fieldError('keywordsText')}
                <p id="keywordsText-help" className="mt-1.5 text-xs text-gray-400">
                  Separate keywords with commas. Use up to 20 keywords, 40 characters each.
                </p>
              </div>
            </div>
          </section>

          {/* Working Hours */}
          <section aria-labelledby="section-hours">
            <h2 id="section-hours" className={sectionHeading}>
              Working Hours
            </h2>
            <div className="space-y-4">
              {workingDays.map(({ key, label }) => {
                const day = profileData.workingHours[key]

                return (
                  <div key={key} className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_1fr] gap-3 sm:items-end">
                    <div>
                      <p className="text-sm font-medium text-gray-700 mb-1.5">{label}</p>
                      <label htmlFor={`${key}-closed`} className="inline-flex items-center gap-2 text-sm text-gray-600">
                        <input
                          type="checkbox"
                          id={`${key}-closed`}
                          checked={day.closed}
                          onChange={(e) => handleClosedChange(key, e.target.checked)}
                          className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-2 focus:ring-blue-500 focus:ring-offset-0"
                        />
                        Closed
                      </label>
                    </div>

                    <div>
                      <label htmlFor={`${key}-open`} className="block text-sm font-medium text-gray-700 mb-1.5">
                        Open
                      </label>
                      <input
                        type="time"
                        id={`${key}-open`}
                        value={day.open}
                        disabled={day.closed}
                        onChange={(e) => handleWorkingHoursChange(key, 'open', e.target.value)}
                        className={`${inputBase} border-gray-300 disabled:bg-gray-50 disabled:text-gray-400`}
                      />
                    </div>

                    <div>
                      <label htmlFor={`${key}-close`} className="block text-sm font-medium text-gray-700 mb-1.5">
                        Close
                      </label>
                      <input
                        type="time"
                        id={`${key}-close`}
                        value={day.close}
                        disabled={day.closed}
                        onChange={(e) => handleWorkingHoursChange(key, 'close', e.target.value)}
                        className={`${inputBase} border-gray-300 disabled:bg-gray-50 disabled:text-gray-400`}
                      />
                    </div>
                  </div>
                )
              })}
              {fieldError('workingHours')}
            </div>
          </section>

          {/* Online Presence */}
          <section aria-labelledby="section-online">
            <h2 id="section-online" className={sectionHeading}>
              Online Presence
            </h2>
            <div className="space-y-5">
              <div>
                <label htmlFor="googleMapsUrl" className="block text-sm font-medium text-gray-700 mb-1.5">
                  Google Maps Link
                  <span className="ml-2 text-xs text-gray-400 font-normal">Optional</span>
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
                  className={`${inputBase} ${errors.googleMapsUrl ? 'border-red-400 bg-red-50/30 focus:ring-red-400' : 'border-gray-300'}`}
                />
                {fieldError('googleMapsUrl')}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                {socialLinkFields.map(({ key, label, placeholder }) => (
                  <div key={key}>
                    <label htmlFor={`social-${key}`} className="block text-sm font-medium text-gray-700 mb-1.5">
                      {label}
                    </label>
                    <input
                      type="url"
                      id={`social-${key}`}
                      value={profileData.socialLinks[key]}
                      onChange={(e) => handleSocialLinkChange(key, e.target.value)}
                      placeholder={placeholder}
                      aria-invalid={!!errors[key]}
                      aria-describedby={errors[key] ? `${key}-error` : undefined}
                      className={`${inputBase} ${errors[key] ? 'border-red-400 bg-red-50/30 focus:ring-red-400' : 'border-gray-300'}`}
                    />
                    {fieldError(key)}
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* Visibility */}
          <section aria-labelledby="section-visibility">
            <h2 id="section-visibility" className={sectionHeading}>
              Visibility
            </h2>
            <div>
              <label htmlFor="isPublic" className="block text-sm font-medium text-gray-700 mb-1.5">
                Profile Visibility
              </label>
              <select
                id="isPublic"
                value={profileData.isPublic ? 'public' : 'private'}
                onChange={(e) => setProfileData({ ...profileData, isPublic: e.target.value === 'public' })}
                className={`${inputBase} border-gray-300 bg-white`}
              >
                <option value="public">Public</option>
                <option value="private">Private</option>
              </select>
              <p className="mt-1.5 text-xs text-gray-400">
                Public profiles can appear in the directory. Private profiles stay hidden from public visitors.
              </p>
            </div>
          </section>

          {/* Branding */}
          <section aria-labelledby="section-branding">
            <h2 id="section-branding" className={sectionHeading}>
              Branding
            </h2>
            <div>
              <label htmlFor="logo" className="block text-sm font-medium text-gray-700 mb-1.5">
                Business Logo
                <span className="ml-2 text-xs text-gray-400 font-normal">Optional</span>
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
                className={`${inputBase} border-gray-300 file:mr-4 file:py-1.5 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 file:transition-colors`}
              />
              {fieldError('logo')}
              {logoFileName ? (
                <p className="mt-1.5 text-xs text-gray-500 flex items-center gap-1">
                  <svg className="w-3.5 h-3.5 text-green-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  {logoFileName}
                </p>
              ) : (
                <p id="logo-help" className="mt-1.5 text-xs text-gray-400">JPG, PNG, or WebP only. Maximum file size is 5 MB.</p>
              )}
            </div>

            <div className="pt-5 border-t border-gray-100">
              <label htmlFor="coverBanner" className="block text-sm font-medium text-gray-700 mb-1.5">
                Cover Banner
                <span className="ml-2 text-xs text-gray-400 font-normal">Optional</span>
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
                className={`${inputBase} border-gray-300 file:mr-4 file:py-1.5 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 file:transition-colors`}
              />
              {fieldError('coverBanner')}
              <p id="coverBanner-help" className="mt-1.5 text-xs text-gray-400">
                Upload a wide banner image for the top of your public business profile. JPG, PNG, or WebP only. Maximum file size is 5 MB.
              </p>
              {coverBannerPreviewUrl && (
                <div className="mt-3">
                  <img
                    src={coverBannerPreviewUrl}
                    alt="Selected cover banner preview"
                    className="w-full aspect-[3/1] rounded-xl object-cover border border-gray-100 bg-gray-50"
                  />
                  <div className="mt-2 flex items-center justify-between gap-3">
                    <p className="text-xs text-gray-500 truncate">
                      {coverBannerFileName || 'Current cover banner'}
                    </p>
                    <button
                      type="button"
                      onClick={handleClearCoverBanner}
                      className="text-xs font-medium text-red-600 hover:text-red-700 focus:outline-none focus:underline"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="pt-5 border-t border-gray-100">
              <label htmlFor="galleryImages" className="block text-sm font-medium text-gray-700 mb-1.5">
                Business Gallery
                <span className="ml-2 text-xs text-gray-400 font-normal">Optional</span>
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
                className={`${inputBase} border-gray-300 file:mr-4 file:py-1.5 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 file:transition-colors`}
              />
              {fieldError('galleryImages')}
              <p id="galleryImages-help" className="mt-1.5 text-xs text-gray-400">
                Upload photos of your shop, clinic, office, work, products, or services. Up to {MAX_GALLERY_IMAGES} images.
              </p>

              {(profileData.existingGalleryImageUrls.length > 0 || selectedGalleryPreviews.length > 0) && (
                <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {profileData.existingGalleryImageUrls.map((url) => (
                    <div key={url} className="relative group">
                      <img
                        src={url}
                        alt="Saved gallery preview"
                        className="w-full aspect-square rounded-xl object-cover border border-gray-100 bg-gray-50"
                      />
                      <button
                        type="button"
                        onClick={() => handleRemoveExistingGalleryImage(url)}
                        className="absolute top-2 right-2 rounded-full bg-white/95 px-2 py-1 text-xs font-medium text-red-600 shadow-sm hover:bg-white focus:outline-none focus:ring-2 focus:ring-red-400"
                      >
                        Remove
                      </button>
                    </div>
                  ))}

                  {selectedGalleryPreviews.map((preview, index) => (
                    <div key={preview.key} className="relative group">
                      <img
                        src={preview.url}
                        alt={`Selected gallery preview ${index + 1}`}
                        className="w-full aspect-square rounded-xl object-cover border border-gray-100 bg-gray-50"
                      />
                      <button
                        type="button"
                        onClick={() => handleRemoveSelectedGalleryImage(index)}
                        className="absolute top-2 right-2 rounded-full bg-white/95 px-2 py-1 text-xs font-medium text-red-600 shadow-sm hover:bg-white focus:outline-none focus:ring-2 focus:ring-red-400"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>

          {/* ── Buttons ── */}
          <div className="flex flex-col sm:flex-row gap-3 pt-2 border-t border-gray-100">
            <button
              type="submit"
              disabled={isSubmitting}
              aria-busy={isSubmitting}
              className="inline-flex items-center justify-center gap-2 px-8 py-3 text-sm font-semibold text-white bg-blue-600 rounded-full hover:bg-blue-700 active:scale-95 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all disabled:opacity-70 disabled:cursor-not-allowed disabled:active:scale-100"
            >
              {isSubmitting ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Loading…
                </>
              ) : (
                <>
                  {isEditMode ? 'Update Profile' : 'Preview Profile'}
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => navigate('/dashboard')}
              className="inline-flex items-center justify-center gap-2 px-6 py-3 text-sm font-medium text-gray-700 bg-white rounded-full hover:bg-gray-50 active:scale-95 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2 transition-all border border-gray-200"
            >
              Dashboard
            </button>

            <button
              type="button"
              onClick={handleClearForm}
              className="inline-flex items-center justify-center gap-2 px-6 py-3 text-sm font-medium text-red-600 bg-red-50 rounded-full hover:bg-red-100 active:scale-95 focus:outline-none focus:ring-2 focus:ring-red-400 focus:ring-offset-2 transition-all"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              Clear Form
            </button>
          </div>

        </form>
      </main>
    </div>
  )
}

export default CreateProfilePage
