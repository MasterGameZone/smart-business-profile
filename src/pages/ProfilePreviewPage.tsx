import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import QRCode from 'react-qr-code'
import { useProfile } from '../context/ProfileContext.tsx'

function ProfilePreviewPage() {
  const navigate = useNavigate()
  const { profileData } = useProfile()

  const [copyMessage, setCopyMessage] = useState('')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true))
    return () => cancelAnimationFrame(id)
  }, [])

  const logoUrl = useMemo(() => {
    if (profileData.logo) {
      return URL.createObjectURL(profileData.logo)
    }
    return null
  }, [profileData.logo])

  useEffect(() => {
    return () => {
      if (logoUrl) URL.revokeObjectURL(logoUrl)
    }
  }, [logoUrl])

  const profileUrl = window.location.href

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: profileData.businessName || 'Business Profile',
          url: profileUrl,
        })
      } catch {
      }
    } else {
      try {
        await navigator.clipboard.writeText(profileUrl)
        setCopyMessage('Profile link copied to clipboard.')
        setTimeout(() => setCopyMessage(''), 3000)
      } catch {
        setCopyMessage('Unable to copy link.')
        setTimeout(() => setCopyMessage(''), 3000)
      }
    }
  }

  const displayPhone = profileData.phoneNumber.trim()
  const displayWhatsApp = profileData.whatsappNumber.trim() || displayPhone
  const displayEmail = profileData.email.trim()
  const firstLetter = profileData.businessName.trim().charAt(0).toUpperCase()
  const hasProfile = profileData.businessName.trim().length > 0

  const hasContact =
    displayPhone ||
    profileData.whatsappNumber.trim() ||
    profileData.email ||
    profileData.website

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-100 to-blue-50 py-10 px-4">
      <div
        className={`max-w-lg mx-auto transition-all duration-500 ease-out ${
          mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'
        }`}
      >
        {/* ── Main Card ── */}
        <article className="bg-white rounded-3xl shadow-xl overflow-hidden">

          {/* Banner */}
          <div
            aria-hidden="true"
            className="h-32 bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-700 relative"
          >
            <div className="absolute inset-0 opacity-10"
              style={{
                backgroundImage:
                  'radial-gradient(circle at 20% 50%, white 1px, transparent 1px), radial-gradient(circle at 80% 20%, white 1px, transparent 1px)',
                backgroundSize: '40px 40px',
              }}
            />
          </div>

          <div className="px-6 sm:px-8 pb-8">
            {/* ── Identity ── */}
            <div className="flex flex-col items-center -mt-14 mb-6">
              <div
                className="w-28 h-28 rounded-full border-4 border-white bg-white shadow-lg flex items-center justify-center overflow-hidden ring-4 ring-blue-50"
                aria-label={logoUrl ? 'Business logo' : `${firstLetter || '?'} placeholder`}
              >
                {logoUrl ? (
                  <img
                    src={logoUrl}
                    alt={`${profileData.businessName} logo`}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-4xl font-bold text-blue-600 select-none">
                    {firstLetter || '?'}
                  </span>
                )}
              </div>

              <h1 className="mt-4 text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight text-center leading-tight">
                {profileData.businessName || 'Your Business'}
              </h1>

              {profileData.businessCategory && (
                <span className="mt-2 inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-50 text-blue-700">
                  {profileData.businessCategory}
                </span>
              )}

              {profileData.ownerName && (
                <p className="mt-2 text-sm text-gray-500">
                  {profileData.ownerName}
                </p>
              )}
            </div>

            {/* About */}
            {profileData.aboutBusiness && (
              <div className="mb-6 px-4 py-3 bg-slate-50 rounded-2xl">
                <p className="text-sm text-gray-600 leading-relaxed text-center">
                  {profileData.aboutBusiness}
                </p>
              </div>
            )}

            {/* ── Contact Section ── */}
            {hasContact && (
              <section aria-label="Contact information" className="mb-6">
                <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-3">
                  Contact
                </h2>
                <ul className="space-y-2.5">
                  {displayPhone && (
                    <li className="flex items-center gap-3">
                      <span className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center shrink-0" aria-hidden="true">
                        <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                        </svg>
                      </span>
                      <span className="text-sm text-gray-700">{displayPhone}</span>
                    </li>
                  )}

                  {profileData.whatsappNumber.trim() && (
                    <li className="flex items-center gap-3">
                      <span className="w-9 h-9 rounded-xl bg-green-50 flex items-center justify-center shrink-0" aria-hidden="true">
                        <svg className="w-4 h-4 text-green-600" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                        </svg>
                      </span>
                      <span className="text-sm text-gray-700">{profileData.whatsappNumber}</span>
                    </li>
                  )}

                  {profileData.email && (
                    <li className="flex items-center gap-3">
                      <span className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center shrink-0" aria-hidden="true">
                        <svg className="w-4 h-4 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                      </span>
                      <span className="text-sm text-gray-700 break-all">{profileData.email}</span>
                    </li>
                  )}

                  {profileData.website && (
                    <li className="flex items-center gap-3">
                      <span className="w-9 h-9 rounded-xl bg-indigo-50 flex items-center justify-center shrink-0" aria-hidden="true">
                        <svg className="w-4 h-4 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                        </svg>
                      </span>
                      <a
                        href={profileData.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-blue-600 hover:underline focus:outline-none focus:underline truncate"
                      >
                        {profileData.website.replace(/^https?:\/\//, '')}
                      </a>
                    </li>
                  )}
                </ul>
              </section>
            )}

            {/* ── Business Details Section ── */}
            {profileData.address && (
              <section aria-label="Business details" className="mb-6">
                <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-3">
                  Business Details
                </h2>
                <ul className="space-y-2.5">
                  <li className="flex items-start gap-3">
                    <span className="w-9 h-9 rounded-xl bg-orange-50 flex items-center justify-center shrink-0 mt-0.5" aria-hidden="true">
                      <svg className="w-4 h-4 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    </span>
                    <span className="text-sm text-gray-700 whitespace-pre-line leading-relaxed">
                      {profileData.address}
                    </span>
                  </li>
                </ul>
              </section>
            )}

            {/* ── Action Buttons ── */}
            <div
              className="grid grid-cols-2 gap-3"
              role="group"
              aria-label="Contact actions"
            >
              <a
                href={displayPhone ? `tel:${displayPhone}` : undefined}
                aria-label="Call business"
                aria-disabled={!displayPhone}
                className={`flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-semibold transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 ${
                  displayPhone
                    ? 'bg-blue-600 text-white hover:bg-blue-700 active:scale-95'
                    : 'bg-gray-100 text-gray-400 cursor-not-allowed pointer-events-none'
                }`}
              >
                <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
                Call
              </a>

              <a
                href={displayWhatsApp ? `https://wa.me/${displayWhatsApp.replace(/\D/g, '')}` : undefined}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Open WhatsApp"
                aria-disabled={!displayWhatsApp}
                className={`flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-semibold transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 ${
                  displayWhatsApp
                    ? 'bg-green-600 text-white hover:bg-green-700 active:scale-95'
                    : 'bg-gray-100 text-gray-400 cursor-not-allowed pointer-events-none'
                }`}
              >
                <svg className="w-4 h-4 shrink-0" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                </svg>
                WhatsApp
              </a>

              <a
                href={displayEmail ? `mailto:${displayEmail}` : undefined}
                aria-label="Send email"
                aria-disabled={!displayEmail}
                className={`flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-semibold transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-500 ${
                  displayEmail
                    ? 'bg-slate-700 text-white hover:bg-slate-800 active:scale-95'
                    : 'bg-gray-100 text-gray-400 cursor-not-allowed pointer-events-none'
                }`}
              >
                <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                Email
              </a>

              <button
                type="button"
                onClick={handleShare}
                aria-label="Share profile"
                className="flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-semibold bg-indigo-600 text-white hover:bg-indigo-700 active:scale-95 transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                </svg>
                Share
              </button>
            </div>

            {copyMessage && (
              <p
                role="status"
                aria-live="polite"
                className="mt-3 text-sm text-green-600 font-medium text-center"
              >
                {copyMessage}
              </p>
            )}
          </div>
        </article>

        {/* ── QR Code Card ── */}
        {hasProfile && (
          <section
            aria-label="QR Code"
            className="mt-5 bg-white rounded-3xl shadow-xl px-6 sm:px-8 py-8"
          >
            <div className="text-center mb-6">
              <h2 className="text-base font-bold text-gray-900 tracking-tight">
                QR Code
              </h2>
              <p className="mt-1 text-sm text-gray-500">
                Scan this QR Code to open this business profile.
              </p>
            </div>

            <div className="flex justify-center">
              <div className="p-4 border-2 border-gray-100 rounded-2xl bg-white shadow-inner">
                <QRCode
                  value={profileUrl}
                  size={180}
                  bgColor="#ffffff"
                  fgColor="#1e293b"
                  level="M"
                />
              </div>
            </div>
          </section>
        )}

        {/* ── Back to Edit ── */}
        <div className="mt-5 text-center pb-6">
          <button
            type="button"
            onClick={() => navigate('/create-profile')}
            className="inline-flex items-center justify-center gap-2 px-8 py-3 text-sm font-medium text-gray-600 bg-white rounded-full hover:bg-gray-50 active:scale-95 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2 transition-all duration-150 shadow-sm"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 17l-5-5m0 0l5-5m-5 5h12" />
            </svg>
            Back to Edit
          </button>
        </div>
      </div>
    </div>
  )
}

export default ProfilePreviewPage
