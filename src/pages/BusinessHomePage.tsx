import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import AppHeader from '../components/AppHeader.tsx'
import { ToastContainer, type ToastItem, type ToastType } from '../components/Toast.tsx'
import {
  normalizeBusinessProfileDocuments,
  normalizeFaqItems,
  normalizeProductItems,
  normalizeQualificationItems,
  normalizeStringArray,
  formatKeywordsForForm,
  formatServicesForForm,
  normalizeSocialLinks,
  normalizeWorkingHours,
  useProfile,
} from '../context/ProfileContext.tsx'
import { useAuth } from '../context/AuthContext.tsx'
import { useBusinessSubscription } from '../context/BusinessSubscriptionContext.tsx'
import { usePageMeta } from '../hooks/usePageMeta.ts'
import { getBusinessProfilesByOwner, updateBusinessAvailabilityOverride } from '../lib/businessProfileService.ts'
import { getBusinessProfileCompletion } from '../lib/profileCompletion.ts'
import type { RazorpaySubscriptionReconciliationData } from '../lib/businessSubscriptionService.ts'
import type { BusinessProfileRow } from '../types/businessProfile.ts'

type LoadState = 'loading' | 'found' | 'empty' | 'error'
type BusinessOwnerAnalyticsCardState =
  | 'loading'
  | 'pending'
  | 'error'
  | 'premium'
  | 'pro-active'
  | 'pro-canceled'
  | 'pro-payment-issue'
  | 'access-ended'

function getInitials(value: string): string {
  const parts = value
    .trim()
    .split(/\s+/)
    .filter(Boolean)

  if (parts.length === 0) return 'BP'

  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')
}

function formatBusinessSubscriptionDate(value: string | null): string | null {
  if (!value) return null

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null

  return date.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function getBusinessHomeReconciliationMessage(result: RazorpaySubscriptionReconciliationData): string | null {
  switch (result.result) {
    case 'reconciled':
    case 'already_reconciled':
      return null
    case 'no_provider_subscription':
      return 'No existing subscription needs refreshing.'
    case 'payment_not_confirmed':
    case 'provider_state_not_entitled':
      return 'Payment status was checked. Analytics access is not active.'
    case 'manual_review_required':
      return 'Payment status requires review. Analytics access remains locked.'
  }
}

function getManualAvailabilityStatus(profile: BusinessProfileRow): 'open' | 'closed' {
  return profile.availability_override === 'open' ? 'open' : 'closed'
}

function EditIcon() {
  return (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M16.862 4.487a2.625 2.625 0 113.712 3.712L8.25 20.523 3 21l.477-5.25L16.862 4.487z" />
    </svg>
  )
}

function ViewIcon() {
  return (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M2.25 12s3.75-7.5 9.75-7.5 9.75 7.5 9.75 7.5-3.75 7.5-9.75 7.5S2.25 12 2.25 12z" />
      <circle cx="12" cy="12" r="3" strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} />
    </svg>
  )
}

function ShareIcon() {
  return (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M7.5 12.75a2.25 2.25 0 100-4.5 2.25 2.25 0 000 4.5zm9 5.25a2.25 2.25 0 100-4.5 2.25 2.25 0 000 4.5zM16.5 6.75a2.25 2.25 0 100-4.5 2.25 2.25 0 000 4.5z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9.33 11.17l5.34-2.84M9.33 12.83l5.34 2.84" />
    </svg>
  )
}

function QrIcon() {
  return (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4.5 4.5h5v5h-5v-5zm0 10h5v5h-5v-5zm10-10h5v5h-5v-5zm0 5h2v2h-2v-2zm-5 5h2v2h-2v-2zm5 5h2v2h-2v-2zm5-5h-2v-2h2v2zm-5 0h-2v-2h2v2z" />
    </svg>
  )
}

function StatusIcon() {
  return (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 6v6l4 2m5-2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  )
}

function GalleryIcon() {
  return (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 5.25A1.25 1.25 0 015.25 4h13.5A1.25 1.25 0 0120 5.25v10.5A1.25 1.25 0 0118.75 17H5.25A1.25 1.25 0 014 15.75V5.25z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8.25 10.5a1.5 1.5 0 100-3 1.5 1.5 0 000 3zM4 14l4.5-4.5 3.75 3.75L15.5 10l4.5 4.5" />
    </svg>
  )
}

function ChartIcon() {
  return (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 19.5h16M6.5 16V10m5 6V7m5.5 9V12" />
    </svg>
  )
}

function PlusIcon() {
  return (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 5v14M5 12h14" />
    </svg>
  )
}

function HelpCardIcon() {
  return (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 17h.01" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9.09 9a3 3 0 115.82 1c0 2-3 2-3 4" />
      <circle cx="12" cy="12" r="9" strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} />
    </svg>
  )
}

function HelpIcon() {
  return (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 17h.01" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9.09 9a3 3 0 115.82 1c0 2-3 2-3 4" />
      <circle cx="12" cy="12" r="9" strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} />
    </svg>
  )
}

function SupportIcon() {
  return (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 22a2 2 0 002-2h-4a2 2 0 002 2z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M18 16v-4a6 6 0 10-12 0v4l-2 2h16l-2-2z" />
    </svg>
  )
}

function BusinessHomePage() {
  const navigate = useNavigate()
  const { user, accountMode, isLoading } = useAuth()
  const {
    subscription,
    hasProAccess,
    isLoading: isSubscriptionLoading,
    isRefreshing: isSubscriptionRefreshing,
    error: subscriptionError,
    isReconciliationInFlight,
    reconcileBusinessSubscription,
  } = useBusinessSubscription()
  const { profileData, setProfileData, clearProfile } = useProfile()

  usePageMeta({
    title: 'Business Home | Smart Business Profile',
    description: 'Manage your business profiles from one place.',
  })

  const [loadState, setLoadState] = useState<LoadState>('loading')
  const [profiles, setProfiles] = useState<BusinessProfileRow[]>([])
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const [availabilitySavingProfileId, setAvailabilitySavingProfileId] = useState<string | null>(null)
  const [businessOwnerAnalyticsOpenRequest, setBusinessOwnerAnalyticsOpenRequest] = useState<number | null>(null)
  const [analyticsCardFeedback, setAnalyticsCardFeedback] = useState<string | null>(null)

  const featuredProfile = profiles[0] ?? null
  const hasBusinessProfile = Boolean(featuredProfile && loadState === 'found')
  const ownerName = featuredProfile?.owner_name.trim() || profileData.ownerName.trim() || user?.user_metadata?.full_name?.trim() || 'there'
  const businessName = featuredProfile?.business_name.trim() || profileData.businessName.trim() || 'Business profile'
  const businessCategory = featuredProfile?.business_category.trim() || profileData.businessCategory.trim() || ''
  const businessLogoUrl = featuredProfile?.logo_url || null
  const businessInitials = getInitials(businessName)
  const analyticsAccessIsChecking =
    (isSubscriptionLoading || isSubscriptionRefreshing) && !isReconciliationInFlight
  const formattedAnalyticsAccessEndDate = formatBusinessSubscriptionDate(subscription.currentPeriodEnd)
  const formattedAnalyticsGracePeriodEndDate = formatBusinessSubscriptionDate(subscription.gracePeriodEnd)
  const analyticsCardState: BusinessOwnerAnalyticsCardState = analyticsAccessIsChecking
    ? 'loading'
    : isReconciliationInFlight || subscription.status === 'incomplete'
      ? 'pending'
      : subscriptionError
        ? 'error'
        : hasProAccess && subscription.status === 'canceled'
          ? 'pro-canceled'
          : hasProAccess && subscription.status === 'past_due'
            ? 'pro-payment-issue'
            : hasProAccess
              ? 'pro-active'
              : subscription.status === 'canceled' || subscription.status === 'expired'
                ? 'access-ended'
                : 'premium'
  const analyticsCardBadge =
    analyticsCardState === 'loading'
      ? 'Checking'
      : analyticsCardState === 'pending'
        ? 'PENDING'
        : analyticsCardState === 'error'
          ? 'CHECK REQUIRED'
          : analyticsCardState === 'premium'
            ? 'PREMIUM'
            : analyticsCardState === 'pro-canceled'
              ? 'PRO • RENEWAL CANCELLED'
              : analyticsCardState === 'pro-payment-issue'
                ? 'PRO • PAYMENT ISSUE'
                : analyticsCardState === 'access-ended'
                  ? 'ACCESS ENDED'
                  : 'PRO'
  const analyticsCardDescription =
    analyticsCardState === 'loading'
      ? 'Checking Analytics access…'
      : analyticsCardState === 'pending'
        ? 'Payment confirmation is still pending.'
        : analyticsCardState === 'error'
          ? 'Analytics access could not be confirmed.'
          : analyticsCardState === 'premium'
            ? 'Unlock profile views, customer actions, trends, and insights.'
            : analyticsCardState === 'pro-payment-issue'
              ? 'Analytics access is temporarily available during the grace period.'
              : analyticsCardState === 'access-ended'
                ? 'Your Pro Analytics access has ended.'
                : 'View profile performance and customer actions.'
  const analyticsCardStatusLine =
    analyticsCardFeedback ??
    (analyticsCardState === 'pending'
      ? isReconciliationInFlight
        ? 'Checking payment status…'
        : 'Refresh your subscription status before trying again.'
      : analyticsCardState === 'pro-active'
        ? 'Pro Analytics active'
        : analyticsCardState === 'pro-canceled'
          ? formattedAnalyticsAccessEndDate
            ? `Access until ${formattedAnalyticsAccessEndDate}`
            : null
          : analyticsCardState === 'pro-payment-issue'
            ? formattedAnalyticsGracePeriodEndDate
              ? `Payment grace period until ${formattedAnalyticsGracePeriodEndDate}`
              : 'Please update your subscription payment.'
            : null)
  const analyticsCardAction =
    analyticsCardState === 'loading'
      ? 'Checking Analytics access…'
      : analyticsCardState === 'pending'
        ? isReconciliationInFlight
          ? 'Checking payment status…'
          : 'Refresh subscription status'
        : analyticsCardState === 'premium' || analyticsCardState === 'access-ended'
          ? 'Upgrade'
          : analyticsCardState === 'error'
            ? 'Open Analytics'
            : 'View Analytics'
  const availabilityStatus = featuredProfile ? getManualAvailabilityStatus(featuredProfile) : 'closed'
  const isAvailabilityOpen = availabilityStatus === 'open'
  const availabilityLabel = isAvailabilityOpen ? 'Open' : 'Closed'
  const isAvailabilitySaving = Boolean(featuredProfile && availabilitySavingProfileId === featuredProfile.id)
  const profileCompletion = getBusinessProfileCompletion(featuredProfile)
  const displayedMissingItems = profileCompletion.missingItems.slice(0, 3)
  const displayedImprovementTips = profileCompletion.improvementTips.slice(0, 3)

  useEffect(() => {
    if (!isLoading && user && accountMode !== 'business_owner') {
      navigate('/', { replace: true })
    }
  }, [accountMode, isLoading, navigate, user])

  const showToast = useCallback((message: string, type: ToastType = 'success') => {
    const id = Date.now()
    setToasts((prev) => [...prev, { id, message, type }])
    setTimeout(() => setToasts((prev) => prev.filter((toast) => toast.id !== id)), 4000)
  }, [])

  const loadProfiles = useCallback(async () => {
    if (!user || isLoading || accountMode !== 'business_owner') return

    setLoadState('loading')
    try {
      const result = await getBusinessProfilesByOwner(user.id)
      setProfiles(result)
      setLoadState(result.length > 0 ? 'found' : 'empty')
    } catch (error) {
      console.error('Failed to load business profiles for business home:', error)
      setProfiles([])
      setLoadState('error')
    }
  }, [accountMode, isLoading, user])

  useEffect(() => {
    loadProfiles()
  }, [loadProfiles])

  const handleCreateProfile = () => {
    clearProfile()
    navigate('/create-profile')
  }

  const handleEditProfile = (profile: BusinessProfileRow, options?: { startAtFirstStep?: boolean }) => {
    setProfileData({
      ...profileData,
      id: profile.id,
      slug: profile.slug,
      ownerId: profile.owner_id,
      businessName: profile.business_name,
      ownerName: profile.owner_name,
      businessCategory: profile.business_category,
      businessSubcategories: Array.isArray(profile.business_subcategories) ? profile.business_subcategories : [],
      establishedYear: typeof profile.established_year === 'number' ? String(profile.established_year) : '',
      yearsOfExperience:
        typeof profile.years_of_experience === 'number' ? String(profile.years_of_experience) : '',
      highlights: normalizeStringArray(profile.highlights),
      faqs: normalizeFaqItems(profile.faqs),
      productsMenuPackages: normalizeProductItems(profile.products_menu_packages),
      qualifications: normalizeQualificationItems(profile.qualifications),
      phoneNumber: profile.phone_number,
      whatsappNumber: profile.whatsapp_number || '',
      email: profile.email || '',
      website: profile.website || '',
      address: profile.address || '',
      aboutBusiness: profile.about_business || '',
      tagline: profile.tagline || '',
      servicesText: formatServicesForForm(profile.services),
      workingHours: normalizeWorkingHours(profile.working_hours),
      googleMapsUrl: profile.google_maps_url || '',
      socialLinks: normalizeSocialLinks(profile.social_links),
      keywordsText: formatKeywordsForForm(profile.keywords),
      isPublic: profile.is_public ?? true,
      logo: null,
      existingLogoUrl: profile.logo_url,
      coverBanner: null,
      existingCoverBannerUrl: profile.cover_banner_url,
      galleryImages: [],
      existingGalleryImageUrls: Array.isArray(profile.gallery_images)
        ? profile.gallery_images.filter((imageUrl): imageUrl is string => typeof imageUrl === 'string')
        : [],
      documentName: '',
      documentFiles: [],
      existingDocuments: normalizeBusinessProfileDocuments(profile.business_profile_documents),
    })
    navigate(options?.startAtFirstStep ? '/create-profile?step=basic' : '/create-profile')
  }

  const handlePreviewProfile = (profile: BusinessProfileRow) => {
    navigate(`/business/${profile.slug}`)
  }

  const handleCopyProfileLink = async (profile: BusinessProfileRow) => {
    const profileUrl = `${window.location.origin}/business/${profile.slug}`

    try {
      if (typeof navigator === 'undefined' || !navigator.clipboard?.writeText) {
        throw new Error('Clipboard unavailable')
      }

      await navigator.clipboard.writeText(profileUrl)
      showToast('Public profile link copied.')
    } catch (error) {
      console.error('Failed to copy public profile link:', error)
      showToast('Unable to copy the public profile link right now.', 'error')
    }
  }

  const handleOpenQrCodePage = (profile: BusinessProfileRow | null) => {
    navigate('/business/qr-code', {
      state: profile
        ? {
            profile: {
              business_name: profile.business_name,
              slug: profile.slug,
            },
          }
        : undefined,
    })
  }

  const handleManageGallery = (profile: BusinessProfileRow) => {
    setProfileData({
      ...profileData,
      id: profile.id,
      slug: profile.slug,
      ownerId: profile.owner_id,
      businessName: profile.business_name,
      ownerName: profile.owner_name,
      businessCategory: profile.business_category,
      businessSubcategories: Array.isArray(profile.business_subcategories) ? profile.business_subcategories : [],
      establishedYear: typeof profile.established_year === 'number' ? String(profile.established_year) : '',
      yearsOfExperience:
        typeof profile.years_of_experience === 'number' ? String(profile.years_of_experience) : '',
      highlights: normalizeStringArray(profile.highlights),
      faqs: normalizeFaqItems(profile.faqs),
      productsMenuPackages: normalizeProductItems(profile.products_menu_packages),
      qualifications: normalizeQualificationItems(profile.qualifications),
      phoneNumber: profile.phone_number,
      whatsappNumber: profile.whatsapp_number || '',
      email: profile.email || '',
      website: profile.website || '',
      address: profile.address || '',
      aboutBusiness: profile.about_business || '',
      tagline: profile.tagline || '',
      servicesText: formatServicesForForm(profile.services),
      workingHours: normalizeWorkingHours(profile.working_hours),
      googleMapsUrl: profile.google_maps_url || '',
      socialLinks: normalizeSocialLinks(profile.social_links),
      keywordsText: formatKeywordsForForm(profile.keywords),
      isPublic: profile.is_public ?? true,
      logo: null,
      existingLogoUrl: profile.logo_url,
      coverBanner: null,
      existingCoverBannerUrl: profile.cover_banner_url,
      galleryImages: [],
      existingGalleryImageUrls: Array.isArray(profile.gallery_images)
        ? profile.gallery_images.filter((imageUrl): imageUrl is string => typeof imageUrl === 'string')
        : [],
      documentName: '',
      documentFiles: [],
      existingDocuments: normalizeBusinessProfileDocuments(profile.business_profile_documents),
    })
    navigate('/create-profile?step=branding-media')
  }

  const handleToggleBusinessAvailability = async (profile: BusinessProfileRow) => {
    const currentStatus = getManualAvailabilityStatus(profile)
    const nextStatus = currentStatus === 'open' ? 'closed' : 'open'

    setAvailabilitySavingProfileId(profile.id)

    try {
      const updated = await updateBusinessAvailabilityOverride(profile.id, nextStatus)
      setProfiles((currentProfiles) =>
        currentProfiles.map((currentProfile) =>
          currentProfile.id === updated.id
            ? {
                ...currentProfile,
                availability_override: updated.availability_override,
                availability_override_updated_at: updated.availability_override_updated_at,
                updated_at: updated.updated_at,
              }
            : currentProfile
        )
      )
      showToast(`Business marked ${nextStatus === 'open' ? 'Open' : 'Closed'}.`)
    } catch (error) {
      console.error('Failed to update business availability:', error)
      showToast('Unable to update availability right now.', 'error')
    } finally {
      setAvailabilitySavingProfileId(null)
    }
  }

  const handleViewHelp = () => {
    navigate('/customer/help-feedback#help')
  }

  const handleContactSupport = () => {
    navigate('/customer/help-feedback#report')
  }

  const handleOpenBusinessOwnerAnalytics = () => {
    setBusinessOwnerAnalyticsOpenRequest((currentRequest) => (currentRequest ?? 0) + 1)
  }

  const handleRefreshAnalyticsSubscription = async () => {
    if (isReconciliationInFlight) {
      return
    }

    setAnalyticsCardFeedback(null)

    try {
      const result = await reconcileBusinessSubscription()
      setAnalyticsCardFeedback(getBusinessHomeReconciliationMessage(result))
    } catch {
      setAnalyticsCardFeedback('We could not refresh your subscription status. Please try again.')
    }
  }

  const handleAnalyticsCardAction = () => {
    if (analyticsCardState === 'loading' || isReconciliationInFlight) {
      return
    }

    if (analyticsCardState === 'pending') {
      void handleRefreshAnalyticsSubscription()
      return
    }

    handleOpenBusinessOwnerAnalytics()
  }

  return (
    <div className="min-h-screen bg-[#eef4fa] text-black">
      <ToastContainer toasts={toasts} />
      <AppHeader
        businessOwnerAnalyticsOpenRequest={businessOwnerAnalyticsOpenRequest}
        businessOwnerMenuState={
          featuredProfile
            ? {
                hasBusinessProfile: true,
                businessProfile: featuredProfile,
                businessName: featuredProfile.business_name,
                ownerEmail: user?.email ?? 'Owner account',
                businessCategory: featuredProfile.business_category,
                businessLogoUrl: featuredProfile.logo_url,
                businessSlug: featuredProfile.slug,
                profileStatusLabel: featuredProfile.is_public === false ? 'Hidden' : 'Published',
              }
            : {
                hasBusinessProfile: false,
                ownerEmail: user?.email ?? 'Owner account',
              }
        }
      />

      <main className="mx-auto max-w-5xl px-4 py-10 sm:py-14">
        <section className="rounded-3xl border border-[#c7d2df] bg-[linear-gradient(135deg,rgba(255,255,255,0.98)_0%,rgba(232,242,252,0.96)_100%)] p-5 shadow-[0_24px_70px_-38px_rgba(2,12,27,0.98)] backdrop-blur-md sm:p-6">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <h1 className="text-2xl font-semibold tracking-tight text-black sm:text-3xl">
                Welcome back, {ownerName}
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-relaxed text-black sm:text-base">
                Manage your business profile and help customers connect with you easily.
              </p>
            </div>

            <div className="flex min-w-0 items-center gap-3 rounded-2xl border border-[#d5deea] bg-white/75 px-3 py-3 shadow-[0_10px_30px_-24px_rgba(15,23,42,0.35)] sm:min-w-[16rem] sm:max-w-[18rem] sm:justify-start">
              {hasBusinessProfile ? (
                <>
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-[#d5deea] bg-slate-100 text-sm font-semibold text-slate-700">
                    {businessLogoUrl ? (
                      <img
                        src={businessLogoUrl}
                        alt={`${businessName} logo`}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <span aria-hidden="true">{businessInitials}</span>
                    )}
                  </div>

                  <div className="min-w-0">
                    <p className="truncate text-base font-semibold tracking-tight text-black sm:text-lg">
                      {businessName}
                    </p>
                    {businessCategory ? (
                      <span className="mt-1 inline-flex max-w-full items-center rounded-full bg-sky-100 px-2.5 py-1 text-xs font-semibold text-sky-800">
                        <span className="truncate">{businessCategory}</span>
                      </span>
                    ) : null}
                  </div>
                </>
              ) : loadState === 'empty' ? (
                <button
                  type="button"
                  onClick={handleCreateProfile}
                  className="flex w-full items-center gap-3 rounded-xl border border-sky-200 bg-sky-50/70 px-3 py-3 text-left transition hover:bg-sky-50 focus:outline-none focus:ring-2 focus:ring-sky-300/80 focus:ring-offset-2 focus:ring-offset-slate-950 sm:min-w-[16rem]"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-sky-100 text-sky-700">
                    <PlusIcon />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold leading-5 text-black">Create Business Profile</span>
                    <span className="mt-0.5 block text-xs leading-4 text-slate-600">
                      Create your first profile to start sharing your business with customers.
                    </span>
                  </span>
                </button>
              ) : (
                <div className="flex min-h-[3.75rem] w-full min-w-0 items-center rounded-xl border border-dashed border-slate-200 bg-white/50 px-3 py-3 sm:min-w-[16rem]" />
              )}
            </div>
          </div>
        </section>

        {loadState === 'found' && profiles.length > 0 && (
          <section className="mt-8 rounded-3xl border border-[#c7d2df] bg-[linear-gradient(135deg,rgba(255,255,255,0.98)_0%,rgba(235,243,251,0.96)_100%)] p-5 shadow-[0_24px_70px_-38px_rgba(2,12,27,0.98)] backdrop-blur-md sm:p-6">
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-lg font-semibold tracking-tight text-black sm:text-xl">Quick Actions</h2>
            </div>

            {profiles[0] && (
              <div className="mt-4 space-y-4">
                <div>
                  <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Core Profile Actions
                  </p>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <button
                      type="button"
                      onClick={() => handleEditProfile(profiles[0], { startAtFirstStep: true })}
                      className="flex min-h-[4.25rem] flex-col justify-center rounded-2xl border border-slate-200 bg-white/80 px-3 py-3 text-left shadow-[0_12px_30px_-24px_rgba(15,23,42,0.35)] transition hover:border-sky-200 hover:bg-sky-50/70 focus:outline-none focus:ring-2 focus:ring-sky-300/80 focus:ring-offset-2 focus:ring-offset-slate-950"
                    >
                      <div className="flex items-center gap-3">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sky-100 text-sky-700">
                          <EditIcon />
                        </span>
                        <span className="text-[13px] font-semibold leading-4 text-black sm:text-sm sm:leading-5">
                          Edit Profile
                        </span>
                      </div>
                      <span className="mt-1 text-xs leading-4 text-slate-600">Update business details</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handlePreviewProfile(profiles[0])}
                      className="flex min-h-[4.25rem] flex-col justify-center rounded-2xl border border-slate-200 bg-white/80 px-3 py-3 text-left shadow-[0_12px_30px_-24px_rgba(15,23,42,0.35)] transition hover:border-sky-200 hover:bg-sky-50/70 focus:outline-none focus:ring-2 focus:ring-sky-300/80 focus:ring-offset-2 focus:ring-offset-slate-950"
                    >
                      <div className="flex items-center gap-3">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-indigo-700">
                          <ViewIcon />
                        </span>
                        <span className="text-[13px] font-semibold leading-4 text-black sm:text-sm sm:leading-5">
                          View Profile
                        </span>
                      </div>
                      <span className="mt-1 text-xs leading-4 text-slate-600">See public profile</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleCopyProfileLink(profiles[0])}
                      className="flex min-h-[4.25rem] flex-col justify-center rounded-2xl border border-slate-200 bg-white/80 px-3 py-3 text-left shadow-[0_12px_30px_-24px_rgba(15,23,42,0.35)] transition hover:border-sky-200 hover:bg-sky-50/70 focus:outline-none focus:ring-2 focus:ring-sky-300/80 focus:ring-offset-2 focus:ring-offset-slate-950"
                    >
                      <div className="flex items-center gap-3">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                          <ShareIcon />
                        </span>
                        <span className="text-[13px] font-semibold leading-4 text-black sm:text-sm sm:leading-5">
                          Share Profile
                        </span>
                      </div>
                      <span className="mt-1 text-xs leading-4 text-slate-600">Share your profile link</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleOpenQrCodePage(profiles[0])}
                      className="flex min-h-[4.25rem] flex-col justify-center rounded-2xl border border-slate-200 bg-white/80 px-3 py-3 text-left shadow-[0_12px_30px_-24px_rgba(15,23,42,0.35)] transition hover:border-sky-200 hover:bg-sky-50/70 focus:outline-none focus:ring-2 focus:ring-sky-300/80 focus:ring-offset-2 focus:ring-offset-slate-950"
                    >
                      <div className="flex items-center gap-3">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-violet-100 text-violet-700">
                          <QrIcon />
                        </span>
                        <span className="text-[13px] font-semibold leading-4 text-black sm:text-sm sm:leading-5">
                          QR Code
                        </span>
                      </div>
                      <span className="mt-1 text-xs leading-4 text-slate-600">View or download QR</span>
                    </button>
                  </div>
                </div>

                <div>
                  <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Business Management Actions
                  </p>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    <div
                      className="flex min-h-[4.25rem] flex-col justify-center rounded-2xl border border-slate-200 bg-white/80 px-3 py-3 text-left shadow-[0_12px_30px_-24px_rgba(15,23,42,0.35)] transition hover:border-sky-200 hover:bg-sky-50/70 focus:outline-none focus:ring-2 focus:ring-sky-300/80 focus:ring-offset-2 focus:ring-offset-slate-950"
                    >
                      <div className="flex items-center gap-3">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700">
                          <StatusIcon />
                        </span>
                        <span className="text-[13px] font-semibold leading-4 text-black sm:text-sm sm:leading-5">
                          Open / Closed
                        </span>
                      </div>
                      <span className="mt-1 text-xs leading-4 text-slate-600">Manage live availability</span>
                      <div className="mt-2 flex items-center gap-2">
                        <button
                          type="button"
                          role="switch"
                          aria-checked={isAvailabilityOpen}
                          aria-label={`Mark business ${isAvailabilityOpen ? 'closed' : 'open'}`}
                          disabled={isAvailabilitySaving}
                          onClick={() => void handleToggleBusinessAvailability(profiles[0])}
                          className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full px-1 transition focus:outline-none focus:ring-2 focus:ring-sky-300/80 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 ${
                            isAvailabilityOpen ? 'bg-emerald-500' : 'bg-slate-300'
                          }`}
                        >
                          <span
                            className={`h-5 w-5 rounded-full bg-white shadow-sm transition ${
                              isAvailabilityOpen ? 'translate-x-5' : 'translate-x-0'
                            }`}
                            aria-hidden="true"
                          />
                        </button>
                        <span
                          className={`text-xs font-semibold leading-4 ${
                            isAvailabilityOpen ? 'text-emerald-700' : 'text-slate-700'
                          }`}
                        >
                          {isAvailabilitySaving ? 'Saving...' : availabilityLabel}
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleManageGallery(profiles[0])}
                      className="flex min-h-[4.25rem] flex-col justify-center rounded-2xl border border-slate-200 bg-white/80 px-3 py-3 text-left shadow-[0_12px_30px_-24px_rgba(15,23,42,0.35)] transition hover:border-sky-200 hover:bg-sky-50/70 focus:outline-none focus:ring-2 focus:ring-sky-300/80 focus:ring-offset-2 focus:ring-offset-slate-950"
                    >
                      <div className="flex items-center gap-3">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-pink-100 text-pink-700">
                          <GalleryIcon />
                        </span>
                        <span className="text-[13px] font-semibold leading-4 text-black sm:text-sm sm:leading-5">
                          Manage Gallery
                        </span>
                      </div>
                      <span className="mt-1 text-xs leading-4 text-slate-600">Update business photos</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleAnalyticsCardAction}
                      disabled={analyticsCardState === 'loading' || isReconciliationInFlight}
                      aria-label={
                        analyticsCardState === 'loading'
                          ? 'Checking Analytics access'
                          : analyticsCardState === 'pending'
                          ? 'Refresh subscription status'
                          : analyticsCardState === 'premium' || analyticsCardState === 'access-ended'
                            ? 'Open locked Analytics upgrade preview'
                            : 'Open Analytics'
                      }
                      className="col-span-2 flex min-w-0 flex-col rounded-2xl border border-slate-200 bg-white/80 px-3 py-3 text-left shadow-[0_12px_30px_-24px_rgba(15,23,42,0.35)] transition hover:border-sky-200 hover:bg-sky-50/70 focus:outline-none focus:ring-2 focus:ring-sky-300/80 focus:ring-offset-2 focus:ring-offset-slate-950 disabled:cursor-wait disabled:opacity-80 sm:col-span-1"
                    >
                      <div className="flex items-center gap-3">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-cyan-100 text-cyan-700">
                          <ChartIcon />
                        </span>
                        <h3 className="text-[13px] font-semibold leading-4 text-black sm:text-sm sm:leading-5">
                          Analytics
                        </h3>
                      </div>
                      <div className="mt-3 border-t border-dashed border-slate-200" />
                      <span className="mt-3 block text-xs leading-4 text-slate-600">
                        {analyticsCardDescription}
                      </span>
                      <div className="mt-3 flex min-w-0">
                        <span
                          className={`inline-flex max-w-full items-center gap-1.5 whitespace-normal rounded-full px-2 py-0.5 text-center text-[10px] font-semibold uppercase tracking-[0.12em] leading-tight ${
                            analyticsCardState === 'premium'
                              ? 'bg-violet-100 text-violet-700'
                              : analyticsCardState === 'pending'
                                ? 'bg-amber-100 text-amber-800'
                                : analyticsCardState === 'error' || analyticsCardState === 'pro-payment-issue'
                                  ? 'bg-amber-100 text-amber-800'
                                  : analyticsCardState === 'access-ended'
                                    ? 'bg-slate-100 text-slate-600'
                                    : analyticsCardState === 'loading'
                                      ? 'bg-slate-100 text-slate-600'
                                      : 'bg-emerald-100 text-emerald-700'
                          }`}
                        >
                          <svg className="h-3 w-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 3.75l2.25 4.56 5.03.73-3.64 3.55.86 5.01L12 15.23 7.5 17.6l.86-5.01-3.64-3.55 5.03-.73L12 3.75z" />
                          </svg>
                          {analyticsCardBadge}
                        </span>
                      </div>
                      <div className="mt-3 border-t border-slate-200" />
                      <div className="mt-3 flex min-w-0 items-center justify-between gap-3">
                        {analyticsCardStatusLine ? (
                          <span className="flex min-w-0 items-center gap-1.5 text-xs font-semibold leading-4 text-slate-700" role="status" aria-live="polite">
                            <svg className="h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M7 3.75v3m10-3v3M4.75 9.5h14.5M6 5.5h12A1.5 1.5 0 0119.5 7v11A1.5 1.5 0 0118 19.5H6A1.5 1.5 0 014.5 18V7A1.5 1.5 0 016 5.5z" />
                            </svg>
                            <span className="min-w-0 truncate">{analyticsCardStatusLine}</span>
                          </span>
                        ) : (
                          <span aria-hidden="true" />
                        )}
                        <span className="flex shrink-0 items-center gap-1 text-xs font-semibold leading-4 text-sky-700">
                          {analyticsCardAction}
                          <svg className="h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M5 12h14m-6-6l6 6-6 6" />
                          </svg>
                        </span>
                      </div>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </section>
        )}

        <section className="mt-8 rounded-3xl border border-[#c7d2df] bg-[linear-gradient(135deg,rgba(255,255,255,0.98)_0%,rgba(232,242,252,0.96)_100%)] p-5 shadow-[0_24px_70px_-38px_rgba(2,12,27,0.98)] backdrop-blur-md sm:p-6">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="text-lg font-semibold tracking-tight text-black sm:text-xl">
                {profileCompletion.isComplete ? 'Profile Health' : 'Profile Completion'}
              </h2>
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-black">
                  {profileCompletion.isComplete
                    ? `${profileCompletion.completionPercentLabel}% complete`
                    : `${profileCompletion.completionPercentLabel}%`}
                </span>
                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                    profileCompletion.isComplete
                      ? 'bg-emerald-100 text-emerald-800'
                      : profileCompletion.completionPercent >= 90
                        ? 'bg-sky-100 text-sky-800'
                        : profileCompletion.completionPercent >= 50
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-amber-100 text-amber-800'
                  }`}
                >
                  {profileCompletion.healthLabel}
                </span>
              </div>
            </div>

            <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
              <div
                className="h-full rounded-full bg-[linear-gradient(135deg,#38bdf8_0%,#2563eb_100%)]"
                style={{ width: `${profileCompletion.completionPercent}%` }}
              />
            </div>

            <div>
              <p className="text-sm font-medium text-black">
                {profileCompletion.isComplete
                  ? 'Your profile is complete and ready for customers.'
                  : 'Complete these details to improve your profile:'}
              </p>
              <ul className="mt-3 space-y-2 text-sm text-slate-700">
                {(profileCompletion.isComplete ? displayedImprovementTips : displayedMissingItems).map((item) => (
                  <li key={item} className="flex items-start gap-2">
                    <span className="mt-1 h-1.5 w-1.5 rounded-full bg-sky-500" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
              {profileCompletion.trustBoosters.documentsAdded > 0 && (
                <p className="mt-3 text-xs font-medium text-slate-600">
                  Trust Boosters: {profileCompletion.trustBoosters.documentsAdded} documents added
                </p>
              )}
            </div>

            <div className="pt-1">
              <button
                type="button"
                onClick={() =>
                  featuredProfile
                    ? handleEditProfile(featuredProfile, { startAtFirstStep: true })
                    : handleCreateProfile()
                }
                className="inline-flex items-center justify-center rounded-full border border-sky-400/30 bg-[linear-gradient(135deg,#38bdf8_0%,#2563eb_55%,#0f172a_100%)] px-5 py-2.5 text-sm font-semibold text-white shadow-[0_16px_32px_-20px_rgba(56,189,248,0.42)] focus:outline-none focus:ring-2 focus:ring-sky-300/80 focus:ring-offset-2 focus:ring-offset-slate-950 sm:px-5"
              >
                {profileCompletion.isComplete ? 'Improve Profile' : 'Complete Profile'}
              </button>
            </div>
          </div>
        </section>

        <section className="mt-6 rounded-3xl border border-[#c7d2df] bg-white p-5 shadow-[0_24px_70px_-38px_rgba(2,12,27,0.98)] backdrop-blur-md sm:p-6">
          <div className="flex gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-sky-100 text-sky-700 ring-1 ring-sky-100">
              <HelpCardIcon />
            </div>

            <div className="min-w-0 flex-1">
              <h2 className="text-base font-semibold tracking-tight text-black sm:text-lg">
                Need help improving your profile?
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">
                We’re here to help you make your profile more complete, trustworthy, and useful for customers.
              </p>

              <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={handleViewHelp}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-black shadow-sm transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-sky-300/80 focus:ring-offset-2 focus:ring-offset-slate-950 sm:w-auto"
                >
                  <HelpIcon />
                  <span>View Help</span>
                </button>

                <button
                  type="button"
                  onClick={handleContactSupport}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-sky-400/30 bg-[linear-gradient(135deg,#38bdf8_0%,#2563eb_55%,#0f172a_100%)] px-4 py-2.5 text-sm font-semibold text-white shadow-[0_16px_32px_-20px_rgba(56,189,248,0.42)] transition focus:outline-none focus:ring-2 focus:ring-sky-300/80 focus:ring-offset-2 focus:ring-offset-slate-950 sm:w-auto"
                >
                  <SupportIcon />
                  <span>Contact Support</span>
                </button>
              </div>
            </div>
          </div>
        </section>

      </main>
    </div>
  )
}

export default BusinessHomePage
