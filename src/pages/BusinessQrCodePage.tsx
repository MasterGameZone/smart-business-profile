import { useCallback, useRef, useState } from 'react'
import type { RefObject } from 'react'
import QRCode from 'react-qr-code'
import { useLocation, useNavigate } from 'react-router-dom'

import AppHeader from '../components/AppHeader.tsx'
import { ToastContainer, type ToastItem, type ToastType } from '../components/Toast.tsx'
import { usePageMeta } from '../hooks/usePageMeta.ts'
import { svgContainerToBlob, triggerBlobDownload } from '../utils/qr.ts'

interface QrCodePageLocationState {
  profile?: {
    business_name?: string | null
    slug?: string | null
  }
}

function BusinessQrCodePage() {
  const navigate = useNavigate()
  const location = useLocation()
  const state = location.state as QrCodePageLocationState | null
  const qrCodeRef = useRef<HTMLDivElement>(null) as RefObject<HTMLDivElement>
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const businessName = state?.profile?.business_name?.trim() || 'Your Business Profile'
  const slug = state?.profile?.slug?.trim() || ''
  const profileUrl = slug ? `${window.location.origin}/business/${slug}` : ''
  const hasProfileUrl = Boolean(profileUrl)
  const qrFileName = `${businessName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'business-profile'}-qr-code.png`

  const showToast = useCallback((message: string, type: ToastType = 'success') => {
    const id = Date.now()
    setToasts((prev) => [...prev, { id, message, type }])
    setTimeout(() => setToasts((prev) => prev.filter((toast) => toast.id !== id)), 4000)
  }, [])

  const handleDownloadQr = useCallback(async () => {
    if (!hasProfileUrl) return

    try {
      const blob = await svgContainerToBlob(qrCodeRef.current)
      triggerBlobDownload(blob, qrFileName)
      showToast('QR Code downloaded.')
    } catch {
      showToast('Failed to download QR Code.', 'error')
    }
  }, [hasProfileUrl, qrFileName, showToast])

  const handleShareQr = useCallback(async () => {
    if (!hasProfileUrl) return

    try {
      const blob = await svgContainerToBlob(qrCodeRef.current)
      const file = new File([blob], qrFileName, { type: 'image/png' })

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: `${businessName} QR Code`,
          text: profileUrl,
        })
        return
      }

      if (navigator.share) {
        await navigator.share({
          title: `${businessName} QR Code`,
          text: profileUrl,
          url: profileUrl,
        })
        return
      }

      await navigator.clipboard.writeText(profileUrl)
      showToast('Profile link copied to clipboard.')
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        return
      }

      try {
        await navigator.clipboard.writeText(profileUrl)
        showToast('Profile link copied to clipboard.')
      } catch {
        showToast('Unable to share QR Code right now.', 'error')
      }
    }
  }, [businessName, hasProfileUrl, profileUrl, qrFileName, showToast])

  usePageMeta({
    title: hasProfileUrl ? `${businessName} QR Code | Smart Business Profile` : 'Business QR Code | Smart Business Profile',
    description: hasProfileUrl
      ? 'Scan this QR code to open the business profile instantly.'
      : 'Create or publish your business profile first to generate a QR code.',
  })

  return (
    <div className="min-h-screen bg-[#eef4fa] text-black">
      <AppHeader previewConfig={{ backPath: '/business-home', backLabel: 'Home' }} />
      <ToastContainer toasts={toasts} />

      <main className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-5xl items-center justify-center px-4 py-10 sm:py-14">
        <section className="w-full max-w-xl rounded-[2rem] border border-[#c7d2df] bg-[linear-gradient(135deg,rgba(255,255,255,0.98)_0%,rgba(235,243,251,0.96)_100%)] p-6 text-center shadow-[0_24px_70px_-38px_rgba(2,12,27,0.98)] backdrop-blur-md sm:p-8">
          <h1 className="text-2xl font-semibold tracking-tight text-black sm:text-3xl">{businessName}</h1>
          <p className="mt-3 text-sm leading-relaxed text-slate-600 sm:text-base">
            {hasProfileUrl
              ? 'Scan this code to view our business profile instantly.'
              : 'Scan this code to open the business profile.'}
          </p>

          {hasProfileUrl ? (
            <>
              <div className="mt-8 flex justify-center">
                <div
                  ref={qrCodeRef}
                  className="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-[0_20px_50px_-35px_rgba(15,23,42,0.45)]"
                >
                  <QRCode value={profileUrl} size={220} bgColor="#ffffff" fgColor="#0f172a" level="M" />
                </div>
              </div>
              <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={handleDownloadQr}
                  className="inline-flex items-center justify-center rounded-full border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-300 focus:ring-offset-2"
                >
                  Download QR
                </button>
                <button
                  type="button"
                  onClick={handleShareQr}
                  className="inline-flex items-center justify-center rounded-full border border-sky-400/30 bg-[linear-gradient(135deg,#38bdf8_0%,#2563eb_55%,#0f172a_100%)] px-5 py-2.5 text-sm font-semibold text-white shadow-[0_16px_32px_-20px_rgba(56,189,248,0.42)] focus:outline-none focus:ring-2 focus:ring-sky-300/80 focus:ring-offset-2"
                >
                  Share QR
                </button>
              </div>
              <p className="mt-5 break-all text-xs text-slate-500 sm:text-sm">{profileUrl}</p>
            </>
          ) : (
            <div className="mt-8 rounded-[1.75rem] border border-slate-200 bg-white px-5 py-8 text-center shadow-[0_20px_50px_-35px_rgba(15,23,42,0.45)]">
              <p className="text-sm font-medium text-black">
                Create or publish your business profile first to generate a QR code.
              </p>
              <button
                type="button"
                onClick={() => navigate('/create-profile')}
                className="mt-5 inline-flex items-center justify-center rounded-full border border-sky-400/30 bg-[linear-gradient(135deg,#38bdf8_0%,#2563eb_55%,#0f172a_100%)] px-5 py-2.5 text-sm font-semibold text-white shadow-[0_16px_32px_-20px_rgba(56,189,248,0.42)] focus:outline-none focus:ring-2 focus:ring-sky-300/80 focus:ring-offset-2 focus:ring-offset-slate-950"
              >
                Create Business Profile
              </button>
            </div>
          )}
        </section>
      </main>
    </div>
  )
}

export default BusinessQrCodePage
