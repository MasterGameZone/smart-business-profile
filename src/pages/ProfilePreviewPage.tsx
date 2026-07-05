import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { RefObject } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useProfile } from '../context/ProfileContext.tsx'
import { insertBusinessProfile } from '../lib/businessProfileService.ts'
import { usePageMeta } from '../hooks/usePageMeta.ts'
import { ToastContainer, type ToastItem, type ToastType } from '../components/Toast.tsx'
import BusinessProfileDisplay from '../components/BusinessProfileDisplay.tsx'
import { svgContainerToBlob, triggerBlobDownload } from '../utils/qr.ts'

function parsePreviewServices(text: string): string[] {
  return text
    .split('\n')
    .map((service) => service.trim())
    .filter(Boolean)
}

function parsePreviewKeywords(text: string): string[] {
  const seen = new Set<string>()
  const keywords: string[] = []

  for (const keyword of text.split(',')) {
    const trimmed = keyword.trim()
    const key = trimmed.toLowerCase()
    if (!trimmed || seen.has(key)) continue

    seen.add(key)
    keywords.push(trimmed)
  }

  return keywords
}

function ProfilePreviewPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { profileData, setProfileData } = useProfile()

  usePageMeta({
    title: 'Preview Business Profile | Smart Business Profile',
    description: 'Preview and save your Smart Business Profile before sharing it publicly.',
  })

  const [toasts, setToasts] = useState<ToastItem[]>([])
  const [mounted, setMounted] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [hasSaved, setHasSaved] = useState(Boolean(profileData.id))
  const qrSectionRef = useRef<HTMLElement>(null) as RefObject<HTMLElement>
  const qrCodeRef = useRef<HTMLDivElement>(null) as RefObject<HTMLDivElement>

  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true))
    return () => cancelAnimationFrame(id)
  }, [])

  const showToast = useCallback((message: string, type: ToastType = 'success') => {
    const id = Date.now()
    setToasts((prev) => [...prev, { id, message, type }])
    setTimeout(() => setToasts((prev) => prev.filter((toast) => toast.id !== id)), 4000)
  }, [])

  useEffect(() => {
    const state = location.state as { updateSuccess?: boolean } | null
    if (state?.updateSuccess) {
      showToast('Business Profile updated successfully.')
      navigate(location.pathname, { replace: true, state: null })
    }
  }, [location.pathname, location.state, navigate, showToast])

  const logoUrl = useMemo(() => {
    if (profileData.logo) return URL.createObjectURL(profileData.logo)
    return null
  }, [profileData.logo])

  useEffect(() => {
    return () => {
      if (logoUrl) URL.revokeObjectURL(logoUrl)
    }
  }, [logoUrl])

  const profileUrl = window.location.href
  const previewServices = useMemo(() => parsePreviewServices(profileData.servicesText), [profileData.servicesText])
  const previewKeywords = useMemo(() => parsePreviewKeywords(profileData.keywordsText), [profileData.keywordsText])

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: profileData.businessName || 'Business Profile',
          url: profileUrl,
        })
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

  const handleSaveProfile = async () => {
    if (isSaving || hasSaved) return

    if (
      !profileData.businessName.trim() ||
      !profileData.ownerName.trim() ||
      !profileData.businessCategory ||
      !profileData.phoneNumber.trim()
    ) {
      showToast('Please complete all required fields before saving.', 'error')
      return
    }

    setIsSaving(true)
    try {
      const saved = await insertBusinessProfile(profileData)
      setProfileData({
        ...profileData,
        id: saved.id,
        slug: saved.slug,
        ownerId: saved.owner_id,
        existingLogoUrl: saved.logo_url,
      })
      setHasSaved(true)
      showToast('Business Profile saved successfully.')
    } catch (error) {
      console.error('Failed to save business profile:', error)
      showToast('Something went wrong while saving. Please try again.', 'error')
    } finally {
      setIsSaving(false)
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
          title: `${profileData.businessName || 'Business'} QR Code`,
        })
      } else {
        triggerBlobDownload(blob, 'business-profile-qr.png')
        showToast("Your browser doesn't support direct QR sharing. The QR Code has been downloaded instead.", 'info')
      }
    } catch {
      // User cancelled share.
    }
  }

  const handleEditProfile = () => {
    navigate('/create-profile')
  }

  const hasProfile = profileData.businessName.trim().length > 0

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-100 to-blue-50 pb-12">
      <ToastContainer toasts={toasts} />

      <div
        className={`mx-auto max-w-2xl px-4 pt-6 transition-all duration-500 ease-out ${
          mounted ? 'translate-y-0 opacity-100' : 'translate-y-3 opacity-0'
        }`}
      >
        {!hasProfile && (
          <div className="flex min-h-[70vh] flex-col items-center justify-center px-4 text-center">
            <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-blue-50">
              <svg className="h-10 w-10 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
            <h1 className="mb-2 text-2xl font-bold text-gray-900">No Business Profile Found</h1>
            <p className="mb-8 max-w-sm text-gray-500">Create your business profile to see it here.</p>
            <button
              type="button"
              onClick={() => navigate('/create-profile')}
              className="inline-flex items-center gap-2 rounded-full bg-blue-600 px-8 py-3 text-sm font-semibold text-white transition-all hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 active:scale-95"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Create Business Profile
            </button>
          </div>
        )}

        {hasProfile && (
          <BusinessProfileDisplay
            profile={{
              businessName: profileData.businessName,
              ownerName: profileData.ownerName,
              businessCategory: profileData.businessCategory,
              phoneNumber: profileData.phoneNumber,
              whatsappNumber: profileData.whatsappNumber,
              email: profileData.email,
              website: profileData.website,
              address: profileData.address,
              aboutBusiness: profileData.aboutBusiness,
              logoUrl,
              tagline: profileData.tagline,
              services: previewServices,
              workingHours: profileData.workingHours,
              googleMapsUrl: profileData.googleMapsUrl,
              socialLinks: profileData.socialLinks,
              keywords: previewKeywords,
            }}
            profileUrl={profileUrl}
            onShare={handleShare}
            qrSectionRef={qrSectionRef}
            qrCodeRef={qrCodeRef}
            onDownloadQR={handleDownloadQR}
            onShareQR={handleShareQR}
            saveButtonSlot={
              hasSaved ? (
                <button
                  type="button"
                  onClick={handleEditProfile}
                  aria-label="Edit business profile"
                  className="flex items-center justify-center gap-2 rounded-xl bg-amber-500 py-3 text-sm font-semibold text-white transition-all hover:bg-amber-600 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:ring-offset-2 active:scale-95"
                >
                  <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                  Edit Profile
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleSaveProfile}
                  disabled={isSaving}
                  aria-busy={isSaving}
                  aria-label="Save profile to database"
                  className="flex items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3 text-sm font-semibold text-white transition-all hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 active:scale-95 disabled:cursor-not-allowed disabled:opacity-70 disabled:active:scale-100"
                >
                  {isSaving ? (
                    <>
                      <svg className="h-4 w-4 shrink-0 animate-spin" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Saving...
                    </>
                  ) : (
                    <>
                      <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                      </svg>
                      Save Profile
                    </>
                  )}
                </button>
              )
            }
            footerSlot={
              <div className="pb-2 pt-2 text-center">
                <button
                  type="button"
                  onClick={() => navigate('/create-profile')}
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-8 py-3 text-sm font-medium text-gray-600 shadow-sm transition-all hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2 active:scale-95"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 17l-5-5m0 0l5-5m-5 5h12" />
                  </svg>
                  Back to Edit
                </button>
              </div>
            }
          />
        )}
      </div>
    </div>
  )
}

export default ProfilePreviewPage
