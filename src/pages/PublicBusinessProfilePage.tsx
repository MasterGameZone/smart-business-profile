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
import BusinessProfileDisplay from '../components/BusinessProfileDisplay.tsx'
import ReviewSection from '../components/ReviewSection.tsx'
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
  const qrSectionRef = useRef<HTMLElement>(null) as RefObject<HTMLElement>
  const qrCodeRef = useRef<HTMLDivElement>(null) as RefObject<HTMLDivElement>

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
    : 'flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white py-3 text-sm font-semibold text-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-70'

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-100 to-blue-50 pb-12">
      <ToastContainer toasts={toasts} />
      <AppHeader />

      <div className="mx-auto max-w-2xl px-4 pt-6">
        {loadState === 'loading' && (
          <div className="flex min-h-[70vh] flex-col items-center justify-center px-4 text-center">
            <svg className="h-10 w-10 animate-spin text-blue-500" fill="none" viewBox="0 0 24 24" aria-hidden="true">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <p className="mt-4 text-sm text-gray-500">Loading business profile...</p>
          </div>
        )}

        {(loadState === 'not-found' || loadState === 'private' || loadState === 'error') && (
          <div className="flex min-h-[70vh] flex-col items-center justify-center px-4 text-center">
            <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-red-50">
              <svg className="h-10 w-10 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
              </svg>
            </div>
            <h1 className="mb-2 text-2xl font-bold text-gray-900">
              {loadState === 'private' ? 'Business Profile Unavailable' : 'Business Profile Not Found'}
            </h1>
            <p className="mb-8 max-w-sm text-gray-500">
              {loadState === 'private'
                ? 'This business profile is not publicly available.'
                : 'The requested business profile does not exist or may have been removed.'}
            </p>
            <button
              type="button"
              onClick={() => navigate('/')}
              className="inline-flex items-center gap-2 rounded-full bg-blue-600 px-8 py-3 text-sm font-semibold text-white transition-all hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 active:scale-95"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
              Back to Home
            </button>
          </div>
        )}

        {loadState === 'found' && profile && (
          <BusinessProfileDisplay
            profile={{
              businessName: profile.business_name,
              ownerName: profile.owner_name,
              businessCategory: profile.business_category,
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
              <ReviewSection
                businessProfileId={profile.id}
                userId={user?.id ?? null}
                onLogin={() => navigate('/login', { state: { from: location } })}
              />
            }
          />
        )}
      </div>
    </div>
  )
}

export default PublicBusinessProfilePage
