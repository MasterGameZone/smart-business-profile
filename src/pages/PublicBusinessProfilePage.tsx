import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { getBusinessProfileBySlug } from '../lib/businessProfileService.ts'
import { usePageMeta } from '../hooks/usePageMeta.ts'
import type { BusinessProfileRow } from '../types/businessProfile.ts'
import { ToastContainer, type ToastItem, type ToastType } from '../components/Toast.tsx'
import BusinessProfileDisplay from '../components/BusinessProfileDisplay.tsx'
import { svgContainerToBlob, triggerBlobDownload } from '../utils/qr.ts'

type LoadState = 'loading' | 'found' | 'not-found' | 'error'

const META_DESCRIPTION_LENGTH = 155

function truncateMetaDescription(value: string): string {
  if (value.length <= META_DESCRIPTION_LENGTH) return value
  return `${value.slice(0, META_DESCRIPTION_LENGTH - 1).trimEnd()}...`
}

function buildProfileDescription(profile: BusinessProfileRow): string {
  const businessName = profile.business_name.trim() || 'this business'
  const category = profile.business_category.trim()
  const about = profile.about_business?.trim()

  if (!about) {
    return `View contact details, business information, and QR code for ${businessName}.`
  }

  const categoryText = category ? ` - ${category}.` : '.'
  return truncateMetaDescription(`${businessName}${categoryText} ${about}`)
}

function PublicBusinessProfilePage() {
  const navigate = useNavigate()
  const { slug } = useParams<{ slug: string }>()

  const [toasts, setToasts] = useState<ToastItem[]>([])
  const [loadState, setLoadState] = useState<LoadState>('loading')
  const [profile, setProfile] = useState<BusinessProfileRow | null>(null)
  const qrSectionRef = useRef<HTMLElement>(null)
  const qrCodeRef = useRef<HTMLDivElement>(null)

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
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000)
  }, [])

  useEffect(() => {
    let cancelled = false

    async function loadProfile() {
      if (!slug) {
        setLoadState('not-found')
        return
      }

      setLoadState('loading')
      try {
        const result = await getBusinessProfileBySlug(slug)
        if (cancelled) return
        if (result) {
          setProfile(result)
          setLoadState('found')
        } else {
          setLoadState('not-found')
        }
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

  const handleShare = async () => {
    const title = profile?.business_name || 'Business Profile'
    if (navigator.share) {
      try {
        await navigator.share({ title, url: profileUrl })
      } catch {
        // user cancelled — no toast needed
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
      // user cancelled share — no toast
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-100 to-blue-50 pb-12">
      <ToastContainer toasts={toasts} />

      <div className="max-w-2xl mx-auto px-4 pt-6">
        {/* ── Loading State ── */}
        {loadState === 'loading' && (
          <div className="flex flex-col items-center justify-center min-h-[70vh] text-center px-4">
            <svg className="w-10 h-10 text-blue-500 animate-spin" fill="none" viewBox="0 0 24 24" aria-hidden="true">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <p className="mt-4 text-sm text-gray-500">Loading business profile…</p>
          </div>
        )}

        {/* ── Not Found / Error State ── */}
        {(loadState === 'not-found' || loadState === 'error') && (
          <div className="flex flex-col items-center justify-center min-h-[70vh] text-center px-4">
            <div className="w-20 h-20 rounded-full bg-red-50 flex items-center justify-center mb-6">
              <svg className="w-10 h-10 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Business Profile Not Found</h1>
            <p className="text-gray-500 mb-8 max-w-sm">
              The requested business profile does not exist or may have been removed.
            </p>
            <button
              type="button"
              onClick={() => navigate('/')}
              className="inline-flex items-center gap-2 px-8 py-3 bg-blue-600 text-white text-sm font-semibold rounded-full hover:bg-blue-700 active:scale-95 transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
              Back to Home
            </button>
          </div>
        )}

        {/* ── Profile Content ── */}
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
            }}
            profileUrl={profileUrl}
            onShare={handleShare}
            qrSectionRef={qrSectionRef}
            qrCodeRef={qrCodeRef}
            onDownloadQR={handleDownloadQR}
            onShareQR={handleShareQR}
          />
        )}
      </div>
    </div>
  )
}

export default PublicBusinessProfilePage
