import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useProfile } from '../context/ProfileContext.tsx'
import { insertBusinessProfile } from '../lib/businessProfileService.ts'
import { usePageMeta } from '../hooks/usePageMeta.ts'
import { ToastContainer, type ToastItem, type ToastType } from '../components/Toast.tsx'
import BusinessProfileDisplay from '../components/BusinessProfileDisplay.tsx'
import { svgContainerToBlob, triggerBlobDownload } from '../utils/qr.ts'

// ── Page component ─────────────────────────────────────────────────────────
function ProfilePreviewPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { profileData, setProfileData } = useProfile()

  usePageMeta({
    title: 'Preview Business Profile | Smart Business Profile',
    description: 'Preview and save your Smart Business Profile before sharing it publicly.',
  })

  const [toasts, setToasts]     = useState<ToastItem[]>([])
  const [mounted, setMounted]   = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [hasSaved, setHasSaved] = useState(Boolean(profileData.id))
  const qrSectionRef             = useRef<HTMLElement>(null)
  const qrCodeRef                = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true))
    return () => cancelAnimationFrame(id)
  }, [])

  useEffect(() => {
    const state = location.state as { updateSuccess?: boolean } | null
    if (state?.updateSuccess) {
      showToast('Business Profile updated successfully.')
      navigate(location.pathname, { replace: true, state: null })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const logoUrl = useMemo(() => {
    if (profileData.logo) return URL.createObjectURL(profileData.logo)
    return null
  }, [profileData.logo])

  useEffect(() => {
    return () => { if (logoUrl) URL.revokeObjectURL(logoUrl) }
  }, [logoUrl])

  const profileUrl = window.location.href

  // ── Toast helper ──
  const showToast = useCallback((message: string, type: ToastType = 'success') => {
    const id = Date.now()
    setToasts((prev) => [...prev, { id, message, type }])
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000)
  }, [])

  // ── Handlers ──
  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: profileData.businessName || 'Business Profile',
          url: profileUrl,
        })
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
      // user cancelled share — no toast
    }
  }

  const handleEditProfile = () => {
    navigate('/create-profile')
  }

  // ── Derived values ──
  const hasProfile = profileData.businessName.trim().length > 0

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-100 to-blue-50 pb-12">
      <ToastContainer toasts={toasts} />

      <div
        className={`max-w-2xl mx-auto px-4 pt-6 transition-all duration-500 ease-out ${
          mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'
        }`}
      >
        {/* ── Empty State ── */}
        {!hasProfile && (
          <div className="flex flex-col items-center justify-center min-h-[70vh] text-center px-4">
            <div className="w-20 h-20 rounded-full bg-blue-50 flex items-center justify-center mb-6">
              <svg className="w-10 h-10 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">No Business Profile Found</h1>
            <p className="text-gray-500 mb-8 max-w-sm">Create your business profile to see it here.</p>
            <button
              type="button"
              onClick={() => navigate('/create-profile')}
              className="inline-flex items-center gap-2 px-8 py-3 bg-blue-600 text-white text-sm font-semibold rounded-full hover:bg-blue-700 active:scale-95 transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Create Business Profile
            </button>
          </div>
        )}

        {/* ── Profile Content ── */}
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
                  className="flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold bg-amber-500 text-white hover:bg-amber-600 active:scale-95 transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-amber-400"
                >
                  <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
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
                  className="flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold bg-emerald-600 text-white hover:bg-emerald-700 active:scale-95 transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 disabled:opacity-70 disabled:cursor-not-allowed disabled:active:scale-100"
                >
                  {isSaving ? (
                    <>
                      <svg className="w-4 h-4 shrink-0 animate-spin" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Saving…
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                      </svg>
                      Save Profile
                    </>
                  )}
                </button>
              )
            }
            footerSlot={
              <div className="text-center pt-2 pb-2">
                <button
                  type="button"
                  onClick={() => navigate('/create-profile')}
                  className="inline-flex items-center justify-center gap-2 px-8 py-3 text-sm font-medium text-gray-600 bg-white rounded-full hover:bg-gray-50 active:scale-95 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2 transition-all shadow-sm"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
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
