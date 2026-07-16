import { useCallback, useEffect, useRef, useState } from 'react'
import type { RefObject } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { getBusinessProfileBySlug } from '../lib/businessProfileService.ts'
import {
  getFavoriteBusiness,
  removeFavoriteBusiness,
  saveFavoriteBusiness,
} from '../lib/favoriteBusinessService.ts'
import { usePageMeta } from '../hooks/usePageMeta.ts'
import type { BusinessProfileRow } from '../types/businessProfile.ts'
import { ToastContainer, type ToastItem, type ToastType } from '../components/Toast.tsx'
import BusinessProfileDisplay, { businessProfileOuterWrapperClassName } from '../components/BusinessProfileDisplay.tsx'
import ReportProfileAction from '../components/ReportProfileAction.tsx'
import ReviewSection, { type ReviewSummary } from '../components/ReviewSection.tsx'
import { svgContainerToBlob, triggerBlobDownload } from '../utils/qr.ts'
import AppHeader from '../components/AppHeader.tsx'
import { useAuth } from '../context/AuthContext.tsx'
import { saveRecentlyViewedBusiness } from '../utils/recentlyViewed.ts'

type LoadState = 'loading' | 'found' | 'not-found' | 'private' | 'error'

const META_DESCRIPTION_LENGTH = 155

function truncateMetaDescription(value: string): string {
  if (value.length <= META_DESCRIPTION_LENGTH) return value
  return `${value.slice(0, META_DESCRIPTION_LENGTH - 1).trimEnd()}...`
}

function buildProfileDescription(profile: BusinessProfileRow): string {
  const businessName = profile.business_name.trim() || 'this business'
  const tagline = profile.tagline?.trim()
  const category = profile.business_category.trim()
  const about = profile.about_business?.trim()
  const detailParts = [tagline, category, about].filter((value): value is string => Boolean(value))

  if (detailParts.length === 0) {
    return `View contact details, business information, and QR code for ${businessName}.`
  }

  return truncateMetaDescription(`${businessName} - ${detailParts.join('. ')}`)
}

function PublicBusinessProfilePage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { slug } = useParams<{ slug: string }>()
  const { user } = useAuth()

  const [toasts, setToasts] = useState<ToastItem[]>([])
  const [loadState, setLoadState] = useState<LoadState>('loading')
  const [profile, setProfile] = useState<BusinessProfileRow | null>(null)
  const [isFavoriteSaved, setIsFavoriteSaved] = useState(false)
  const [isFavoriteLoading, setIsFavoriteLoading] = useState(false)
  const [hasCheckedFavorite, setHasCheckedFavorite] = useState(false)
  const [reviewSummary, setReviewSummary] = useState<ReviewSummary | null>(null)
  const qrSectionRef = useRef<HTMLElement>(null) as RefObject<HTMLElement>
  const qrCodeRef = useRef<HTMLDivElement>(null) as RefObject<HTMLDivElement>
  const isOwnerPreview = Boolean(user && profile?.owner_id && user.id === profile.owner_id)

  const profileUrl = window.location.href
  const metaBusinessName = profile?.business_name.trim() || 'Business Profile'
  const metaTitle = `${metaBusinessName} | Smart Business Profile`
  const metaDescription = profile
    ? buildProfileDescription(profile)
    : 'View contact details, business information, and QR code for this business profile.'

  usePageMeta({
    title: metaTitle,
    description: metaDescription,
    ogTitle: metaTitle,
    ogDescription: metaDescription,
    ogUrl: profileUrl,
    twitterTitle: metaTitle,
    twitterDescription: metaDescription,
  })

  const showToast = useCallback((message: string, type: ToastType = 'success') => {
    const id = Date.now()
    setToasts((prev) => [...prev, { id, message, type }])
    setTimeout(() => setToasts((prev) => prev.filter((toast) => toast.id !== id)), 4000)
  }, [])

  useEffect(() => {
    let cancelled = false

    async function loadProfile() {
      if (!slug) {
        setProfile(null)
        setLoadState('not-found')
        return
      }

      setProfile(null)
      setReviewSummary(null)
      setLoadState('loading')

      try {
        const result = await getBusinessProfileBySlug(slug)
        if (cancelled) return

        if (!result) {
          setLoadState('not-found')
          return
        }

        if (result.is_public === false) {
          setLoadState('private')
          return
        }

        setProfile(result)
        setLoadState('found')
      } catch (error) {
        if (cancelled) return
        console.error('Failed to load business profile:', error)
        setLoadState('error')
      }
    }

    loadProfile()

    return () => {
      cancelled = true
    }
  }, [slug])

  useEffect(() => {
    if (!user || !profile || loadState !== 'found') return

    saveRecentlyViewedBusiness(user.id, profile)
  }, [loadState, profile, user])

  useEffect(() => {
    let cancelled = false

    async function loadFavoriteStatus() {
      if (!user || !profile || loadState !== 'found') {
        setIsFavoriteSaved(false)
        setHasCheckedFavorite(false)
        return
      }

      setHasCheckedFavorite(false)

      try {
        const favorite = await getFavoriteBusiness(user.id, profile.id)
        if (cancelled) return

        setIsFavoriteSaved(Boolean(favorite))
      } catch (error) {
        if (cancelled) return
        console.error('Failed to load favorite business status:', error)
      } finally {
        if (!cancelled) {
          setHasCheckedFavorite(true)
        }
      }
    }

    loadFavoriteStatus()

    return () => {
      cancelled = true
    }
  }, [loadState, profile, user])

  const handleShare = async () => {
    const title = profile?.business_name || 'Business Profile'
    if (navigator.share) {
      try {
        await navigator.share({ title, url: profileUrl })
      } catch {
        // User cancelled share.
      }
    } else {
      try {
        await navigator.clipboard.writeText(profileUrl)
        showToast('Profile link copied to clipboard.')
      } catch {
        showToast('Unable to copy link.', 'error')
      }
    }
  }

  const handleDownloadQR = async () => {
    try {
      const blob = await svgContainerToBlob(qrCodeRef.current)
      triggerBlobDownload(blob, 'business-profile-qr.png')
      showToast('QR Code downloaded.')
    } catch {
      showToast('Failed to download QR Code.', 'error')
    }
  }

  const handleShareQR = async () => {
    try {
      const blob = await svgContainerToBlob(qrCodeRef.current)
      const file = new File([blob], 'business-profile-qr.png', { type: 'image/png' })
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: `${profile?.business_name || 'Business'} QR Code`,
        })
      } else {
        triggerBlobDownload(blob, 'business-profile-qr.png')
        showToast("Your browser doesn't support direct QR sharing. The QR Code has been downloaded instead.", 'info')
      }
    } catch {
      // User cancelled share.
    }
  }

  const handleFavoriteToggle = useCallback(async () => {
    if (!profile) return

    if (!user) {
      navigate('/login', { state: { from: location } })
      return
    }

    setIsFavoriteLoading(true)

    try {
      if (isFavoriteSaved) {
        await removeFavoriteBusiness(user.id, profile.id)
        setIsFavoriteSaved(false)
        showToast('Business removed from saved businesses.')
      } else {
        await saveFavoriteBusiness(user.id, profile.id)
        setIsFavoriteSaved(true)
        showToast('Business saved.')
      }
    } catch (error) {
      console.error('Failed to update saved business:', error)
      showToast('Unable to update this saved business right now.', 'error')
    } finally {
      setIsFavoriteLoading(false)
      setHasCheckedFavorite(true)
    }
  }, [isFavoriteSaved, location, navigate, profile, showToast, user])

  const favoriteButtonLabel = !user
    ? 'Log in to Save'
    : isFavoriteLoading || !hasCheckedFavorite
      ? 'Loading...'
      : isFavoriteSaved
        ? 'Saved'
        : 'Save'

  const favoriteButtonClass = user && isFavoriteSaved
    ? 'flex items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 py-3 text-sm font-semibold text-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-70'
    : 'flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white py-3 text-sm font-semibold text-black focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-70'
  const compactSecondaryActionClass =
    'inline-flex h-7 items-center justify-center whitespace-nowrap rounded-md border border-slate-300 bg-white px-2 text-[10px] font-medium leading-none text-black transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 sm:h-8 sm:rounded-lg sm:px-3 sm:text-xs'

  const pageBackgroundClass =
    'min-h-screen bg-[#eef4fa] pb-12 text-black'

  return (
    <div className={pageBackgroundClass}>
      <ToastContainer toasts={toasts} />
      <AppHeader
        variant="publicBusinessProfile"
        previewConfig={
          isOwnerPreview
            ? {
                backPath: '/business-home',
                backLabel: 'Home',
              }
            : null
        }
      />

      <div className="mx-auto max-w-2xl px-4 pt-6">
        {loadState === 'loading' && (
          <div className="flex min-h-[70vh] flex-col items-center justify-center px-4 text-center">
            <svg className="h-10 w-10 animate-spin text-blue-500" fill="none" viewBox="0 0 24 24" aria-hidden="true">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <p className="mt-4 text-sm text-black">Loading business profile...</p>
          </div>
        )}

        {(loadState === 'not-found' || loadState === 'private' || loadState === 'error') && (
          <div className="flex min-h-[70vh] flex-col items-center justify-center px-4 text-center">
            <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-red-50">
              <svg className="h-10 w-10 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
              </svg>
            </div>
            <h1 className="mb-2 text-2xl font-bold text-black">
              {loadState === 'private' ? 'Business Profile Unavailable' : 'Business Profile Not Found'}
            </h1>
            <p className="mb-8 max-w-sm text-black">
              {loadState === 'private'
                ? 'This business profile is not publicly available.'
                : 'The requested business profile does not exist or may have been removed.'}
            </p>
            <button
              type="button"
              onClick={() => navigate(isOwnerPreview ? '/business-home' : '/')}
              className="inline-flex items-center gap-2 rounded-full bg-blue-600 px-8 py-3 text-sm font-semibold text-white transition-all hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 active:scale-95"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
              Home
            </button>
          </div>
        )}

        {loadState === 'found' && profile && (
          <div className={businessProfileOuterWrapperClassName}>
            <BusinessProfileDisplay
              profile={{
                businessName: profile.business_name,
                ownerName: profile.owner_name,
                businessCategory: profile.business_category,
                established_year: profile.established_year,
                years_of_experience: profile.years_of_experience,
                products_menu_packages: profile.products_menu_packages,
                faqs: profile.faqs,
                qualifications: profile.qualifications,
                ratingAverage: reviewSummary?.average ?? null,
                ratingCount: reviewSummary?.count ?? null,
                phoneNumber: profile.phone_number,
                whatsappNumber: profile.whatsapp_number || '',
                email: profile.email || '',
                website: profile.website || '',
                address: profile.address || '',
                aboutBusiness: profile.about_business || '',
                logoUrl: profile.logo_url,
                coverBannerUrl: profile.cover_banner_url,
                tagline: profile.tagline,
                services: profile.services,
                workingHours: profile.working_hours,
                availabilityOverride: profile.availability_override,
                googleMapsUrl: profile.google_maps_url,
                socialLinks: profile.social_links,
                keywords: profile.keywords,
                galleryImages: profile.gallery_images,
              }}
              profileUrl={profileUrl}
              onShare={handleShare}
              qrSectionRef={qrSectionRef}
              qrCodeRef={qrCodeRef}
              onDownloadQR={handleDownloadQR}
              onShareQR={handleShareQR}
              saveButtonSlot={
                <button
                  type="button"
                  onClick={handleFavoriteToggle}
                  disabled={isFavoriteLoading || (Boolean(user) && !hasCheckedFavorite)}
                  aria-label={favoriteButtonLabel}
                  className={favoriteButtonClass}
                >
                  <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill={user && isFavoriteSaved ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M6 4.75A1.75 1.75 0 0 1 7.75 3h8.5A1.75 1.75 0 0 1 18 4.75V21l-6-3.75L6 21V4.75z"
                    />
                  </svg>
                  {favoriteButtonLabel}
                </button>
              }
              footerSlot={
                <section
                  aria-label="Ratings actions"
                  className="overflow-hidden rounded-3xl border border-[#c7d2df] bg-white px-5 py-5 shadow-sm sm:px-8 sm:py-6"
                >
                  <div className="flex items-center justify-between gap-1.5 overflow-hidden">
                    <div className="flex min-w-0 items-center gap-1 text-[10px] font-semibold text-black sm:gap-1.5 sm:text-xs">
                      <svg className="h-3 w-3 shrink-0 text-amber-400 sm:h-3.5 sm:w-3.5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                        <path d="M9.05 2.93c.3-.92 1.6-.92 1.9 0l1.18 3.63a1 1 0 0 0 .95.69h3.82c.97 0 1.37 1.24.59 1.81l-3.09 2.24a1 1 0 0 0-.36 1.12l1.18 3.63c.3.92-.76 1.69-1.54 1.12l-3.09-2.24a1 1 0 0 0-1.18 0l-3.09 2.24c-.78.57-1.84-.2-1.54-1.12l1.18-3.63a1 1 0 0 0-.36-1.12L2.51 9.06c-.78-.57-.38-1.81.59-1.81h3.82a1 1 0 0 0 .95-.69l1.18-3.63z" />
                      </svg>
                      <span className="min-w-0 truncate">
                        {reviewSummary && reviewSummary.count > 0
                          ? `${reviewSummary.average.toFixed(1)} Ratings`
                          : 'No Ratings Yet'}
                      </span>
                    </div>

                    <div className="flex shrink-0 items-center gap-1">
                      <ReviewSection
                        businessProfileId={profile.id}
                        businessOwnerId={profile.owner_id}
                        userId={user?.id ?? null}
                        onLogin={() => navigate('/login', { state: { from: location } })}
                        onSummaryChange={setReviewSummary}
                        triggerClassName={compactSecondaryActionClass}
                      />
                      <ReportProfileAction
                        businessProfileId={profile.id}
                        userId={user?.id ?? null}
                        onLogin={() => navigate('/login', { state: { from: location } })}
                        triggerClassName={compactSecondaryActionClass}
                      />
                    </div>
                  </div>
                </section>
              }
            />
          </div>
        )}
      </div>
    </div>
  )
}

export default PublicBusinessProfilePage
