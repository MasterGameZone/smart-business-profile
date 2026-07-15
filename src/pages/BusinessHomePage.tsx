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
import { usePageMeta } from '../hooks/usePageMeta.ts'
import { getBusinessProfilesByOwner } from '../lib/businessProfileService.ts'
import type { BusinessProfileRow } from '../types/businessProfile.ts'

type LoadState = 'loading' | 'found' | 'empty' | 'error'

function truncate(text: string, length: number): string {
  if (text.length <= length) return text
  return `${text.slice(0, length).trimEnd()}...`
}

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

function BusinessHomePage() {
  const navigate = useNavigate()
  const { user, accountMode, isLoading } = useAuth()
  const { profileData, setProfileData, clearProfile } = useProfile()

  usePageMeta({
    title: 'Business Home | Smart Business Profile',
    description: 'Manage your business profiles from one place.',
  })

  const [loadState, setLoadState] = useState<LoadState>('loading')
  const [profiles, setProfiles] = useState<BusinessProfileRow[]>([])
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const featuredProfile = profiles[0] ?? null
  const ownerName = featuredProfile?.owner_name.trim() || profileData.ownerName.trim() || user?.user_metadata?.full_name?.trim() || 'there'
  const businessName = featuredProfile?.business_name.trim() || profileData.businessName.trim() || 'Business profile'
  const businessCategory = featuredProfile?.business_category.trim() || profileData.businessCategory.trim() || ''
  const businessLogoUrl = featuredProfile?.logo_url || null
  const businessInitials = getInitials(businessName)
  const analyticsIsPremium = false

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

  const handleEditProfile = (profile: BusinessProfileRow) => {
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
    navigate('/create-profile')
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

  return (
    <div className="min-h-screen bg-[#eef4fa] text-black">
      <ToastContainer toasts={toasts} />
      <AppHeader />

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
                      onClick={() => handleEditProfile(profiles[0])}
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
                    <button
                      type="button"
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
                    </button>

                    <button
                      type="button"
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
                      className="col-span-2 flex min-h-[4.25rem] flex-col justify-center rounded-2xl border border-slate-200 bg-white/80 px-3 py-3 text-left shadow-[0_12px_30px_-24px_rgba(15,23,42,0.35)] transition hover:border-sky-200 hover:bg-sky-50/70 focus:outline-none focus:ring-2 focus:ring-sky-300/80 focus:ring-offset-2 focus:ring-offset-slate-950 sm:col-span-1"
                    >
                      <div className="flex items-center gap-3">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-cyan-100 text-cyan-700">
                          <ChartIcon />
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="text-[13px] font-semibold leading-4 text-black sm:text-sm sm:leading-5">
                            Analytics
                          </span>
                          {!analyticsIsPremium && (
                            <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] leading-none text-slate-600">
                              Premium
                            </span>
                          )}
                        </div>
                      </div>
                      <span className="mt-1 text-xs leading-4 text-slate-600">View customer activity</span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </section>
        )}

        <section className="mt-8" aria-labelledby="my-business-profiles-heading">
          <div className="mb-5 flex items-center justify-between gap-4">
            <div>
              <h2 id="my-business-profiles-heading" className="text-xl font-semibold tracking-tight text-black sm:text-2xl">
                My Business Profiles
              </h2>
              <p className="mt-1 text-sm text-black">Profiles created under your account.</p>
            </div>
          </div>

          {loadState === 'loading' && (
            <div className="flex min-h-[16rem] items-center justify-center rounded-3xl border border-[#c7d2df] bg-white px-6 py-10 text-center shadow-[0_24px_70px_-38px_rgba(2,12,27,0.98)] backdrop-blur-md">
              <p className="text-sm text-black">Loading your business profiles...</p>
            </div>
          )}

          {loadState === 'error' && (
            <div className="flex min-h-[16rem] items-center justify-center rounded-3xl border border-red-400/20 bg-red-400/10 px-6 py-10 text-center shadow-[0_24px_70px_-38px_rgba(120,53,15,0.45)] backdrop-blur-md">
              <div>
                <p className="text-base font-semibold text-red-700">Unable to load your business profiles right now.</p>
                <button
                  type="button"
                  onClick={loadProfiles}
                  className="mt-4 inline-flex items-center justify-center rounded-full border border-red-300/20 bg-white/[0.04] px-5 py-2.5 text-sm font-medium text-black focus:outline-none focus:ring-2 focus:ring-slate-300/80 focus:ring-offset-2 focus:ring-offset-slate-950"
                >
                  Try Again
                </button>
              </div>
            </div>
          )}

          {loadState === 'empty' && (
            <div className="rounded-3xl border border-[#c7d2df] bg-white px-6 py-12 text-center shadow-[0_24px_70px_-38px_rgba(2,12,27,0.98)] backdrop-blur-md sm:px-8">
              <h3 className="text-xl font-semibold tracking-tight text-black">No business profiles yet.</h3>
              <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-black sm:text-base">
                Create your first business profile to start sharing your business with customers.
              </p>
              <button
                type="button"
                onClick={handleCreateProfile}
                className="mt-6 inline-flex items-center justify-center rounded-full border border-sky-400/30 bg-[linear-gradient(135deg,#38bdf8_0%,#2563eb_55%,#0f172a_100%)] px-5 py-2.5 text-sm font-semibold text-white shadow-[0_16px_32px_-20px_rgba(56,189,248,0.42)] focus:outline-none focus:ring-2 focus:ring-sky-300/80 focus:ring-offset-2 focus:ring-offset-slate-950"
              >
                Create Business Profile
              </button>
            </div>
          )}

          {loadState === 'found' && (
            <div className="grid grid-cols-1 gap-5">
              {profiles.map((profile) => (
                <article
                  key={profile.id}
                  className="rounded-3xl border border-[#c7d2df] bg-white p-6 shadow-[0_24px_70px_-38px_rgba(2,12,27,0.98)] backdrop-blur-md sm:p-8"
                >
                  <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-xl font-semibold tracking-tight text-black">{profile.business_name}</h3>
                        <span
                          className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                            profile.is_public === false
                              ? 'bg-slate-200/10 text-black'
                              : 'bg-emerald-400/12 text-emerald-700'
                          }`}
                        >
                          {profile.is_public === false ? 'Private' : 'Public'}
                        </span>
                      </div>

                      {profile.business_category && (
                        <p className="mt-2 text-sm text-black">{profile.business_category}</p>
                      )}

                      {profile.address && (
                        <p className="mt-1 text-sm text-black">{profile.address}</p>
                      )}

                      {profile.about_business && (
                        <p className="mt-4 max-w-3xl text-sm leading-relaxed text-black">
                          {truncate(profile.about_business, 180)}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="mt-6 flex flex-col gap-3 border-t border-white/10 pt-5 sm:flex-row">
                    <button
                      type="button"
                      onClick={() => handleEditProfile(profile)}
                      className="inline-flex items-center justify-center rounded-full border border-sky-400/30 bg-[linear-gradient(135deg,#38bdf8_0%,#2563eb_55%,#0f172a_100%)] px-5 py-2.5 text-sm font-semibold text-white shadow-[0_16px_32px_-20px_rgba(56,189,248,0.42)] focus:outline-none focus:ring-2 focus:ring-sky-300/80 focus:ring-offset-2 focus:ring-offset-slate-950"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => handlePreviewProfile(profile)}
                      className="inline-flex items-center justify-center rounded-full border border-white/12 bg-white/[0.04] px-5 py-2.5 text-sm font-medium text-black focus:outline-none focus:ring-2 focus:ring-slate-300/80 focus:ring-offset-2 focus:ring-offset-slate-950"
                    >
                      Preview
                    </button>
                    <button
                      type="button"
                      onClick={() => handleCopyProfileLink(profile)}
                      className="inline-flex items-center justify-center rounded-full border border-white/12 bg-white/[0.04] px-5 py-2.5 text-sm font-medium text-black focus:outline-none focus:ring-2 focus:ring-slate-300/80 focus:ring-offset-2 focus:ring-offset-slate-950"
                    >
                      Share / Copy Link
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  )
}

export default BusinessHomePage
