import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import AppHeader from '../components/AppHeader.tsx'
import { ToastContainer, type ToastItem, type ToastType } from '../components/Toast.tsx'
import {
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

function BusinessHomePage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { profileData, setProfileData, clearProfile } = useProfile()

  usePageMeta({
    title: 'Business Home | Smart Business Profile',
    description: 'Manage your business profiles from one place.',
  })

  const [loadState, setLoadState] = useState<LoadState>('loading')
  const [profiles, setProfiles] = useState<BusinessProfileRow[]>([])
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const showToast = useCallback((message: string, type: ToastType = 'success') => {
    const id = Date.now()
    setToasts((prev) => [...prev, { id, message, type }])
    setTimeout(() => setToasts((prev) => prev.filter((toast) => toast.id !== id)), 4000)
  }, [])

  const loadProfiles = useCallback(async () => {
    if (!user) return

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
  }, [user])

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
    <div className="min-h-screen bg-[linear-gradient(180deg,#020617_0%,#030712_34%,#020617_100%)] text-slate-100">
      <ToastContainer toasts={toasts} />
      <AppHeader />

      <main className="mx-auto max-w-5xl px-4 py-10 sm:py-14">
        <section className="rounded-3xl border border-white/10 bg-white/[0.05] p-6 shadow-[0_24px_70px_-38px_rgba(2,12,27,0.98)] backdrop-blur-md sm:p-8">
          <h1 className="text-3xl font-bold tracking-tight text-slate-50 sm:text-4xl">Business Home</h1>
          <p className="mt-4 text-sm leading-relaxed text-slate-300 sm:text-base">
            Manage your business profiles from one place.
          </p>
        </section>

        <section className="mt-8" aria-labelledby="my-business-profiles-heading">
          <div className="mb-5 flex items-center justify-between gap-4">
            <div>
              <h2 id="my-business-profiles-heading" className="text-xl font-semibold tracking-tight text-slate-50 sm:text-2xl">
                My Business Profiles
              </h2>
              <p className="mt-1 text-sm text-slate-400">Profiles created under your account.</p>
            </div>
          </div>

          {loadState === 'loading' && (
            <div className="flex min-h-[16rem] items-center justify-center rounded-3xl border border-white/10 bg-white/[0.05] px-6 py-10 text-center shadow-[0_24px_70px_-38px_rgba(2,12,27,0.98)] backdrop-blur-md">
              <p className="text-sm text-slate-300">Loading your business profiles...</p>
            </div>
          )}

          {loadState === 'error' && (
            <div className="flex min-h-[16rem] items-center justify-center rounded-3xl border border-red-400/20 bg-red-400/10 px-6 py-10 text-center shadow-[0_24px_70px_-38px_rgba(120,53,15,0.45)] backdrop-blur-md">
              <div>
                <p className="text-base font-semibold text-red-100">Unable to load your business profiles right now.</p>
                <button
                  type="button"
                  onClick={loadProfiles}
                  className="mt-4 inline-flex items-center justify-center rounded-full border border-red-300/20 bg-white/[0.04] px-5 py-2.5 text-sm font-medium text-slate-100 focus:outline-none focus:ring-2 focus:ring-slate-300/80 focus:ring-offset-2 focus:ring-offset-slate-950"
                >
                  Try Again
                </button>
              </div>
            </div>
          )}

          {loadState === 'empty' && (
            <div className="rounded-3xl border border-white/10 bg-white/[0.05] px-6 py-12 text-center shadow-[0_24px_70px_-38px_rgba(2,12,27,0.98)] backdrop-blur-md sm:px-8">
              <h3 className="text-xl font-semibold tracking-tight text-slate-50">No business profiles yet.</h3>
              <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-slate-300 sm:text-base">
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
                  className="rounded-3xl border border-white/10 bg-white/[0.05] p-6 shadow-[0_24px_70px_-38px_rgba(2,12,27,0.98)] backdrop-blur-md sm:p-8"
                >
                  <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-xl font-semibold tracking-tight text-slate-50">{profile.business_name}</h3>
                        <span
                          className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                            profile.is_public === false
                              ? 'bg-slate-200/10 text-slate-300'
                              : 'bg-emerald-400/12 text-emerald-200'
                          }`}
                        >
                          {profile.is_public === false ? 'Private' : 'Public'}
                        </span>
                      </div>

                      {profile.business_category && (
                        <p className="mt-2 text-sm text-slate-300">{profile.business_category}</p>
                      )}

                      {profile.address && (
                        <p className="mt-1 text-sm text-slate-400">{profile.address}</p>
                      )}

                      {profile.about_business && (
                        <p className="mt-4 max-w-3xl text-sm leading-relaxed text-slate-300">
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
                      className="inline-flex items-center justify-center rounded-full border border-white/12 bg-white/[0.04] px-5 py-2.5 text-sm font-medium text-slate-100 focus:outline-none focus:ring-2 focus:ring-slate-300/80 focus:ring-offset-2 focus:ring-offset-slate-950"
                    >
                      Preview
                    </button>
                    <button
                      type="button"
                      onClick={() => handleCopyProfileLink(profile)}
                      className="inline-flex items-center justify-center rounded-full border border-white/12 bg-white/[0.04] px-5 py-2.5 text-sm font-medium text-slate-100 focus:outline-none focus:ring-2 focus:ring-slate-300/80 focus:ring-offset-2 focus:ring-offset-slate-950"
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
