import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import QRCode from 'react-qr-code'
import { useProfile } from '../context/ProfileContext.tsx'

function ProfilePreviewPage() {
  const navigate = useNavigate()
  const { profileData } = useProfile()

  const [copyMessage, setCopyMessage] = useState('')
  const [mounted, setMounted] = useState(false)
  const qrSectionRef = useRef<HTMLElement>(null)

  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true))
    return () => cancelAnimationFrame(id)
  }, [])

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

  const scrollToQR = () => {
    qrSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const displayPhone = profileData.phoneNumber.trim()
  const displayWhatsApp = profileData.whatsappNumber.trim() || displayPhone
  const displayEmail = profileData.email.trim()
  const firstLetter = profileData.businessName.trim().charAt(0).toUpperCase()
  const hasProfile = profileData.businessName.trim().length > 0

  const cardBase = 'bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden'
  const sectionHeading = 'text-xs font-semibold uppercase tracking-widest text-gray-400 mb-4'

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-100 to-blue-50 pb-12">
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
            <p className="text-gray-500 mb-8 max-w-sm">
              Create your business profile to see it here.
            </p>
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
          <div className="space-y-4">

            {/* ── Header Card ── */}
            <article className={cardBase}>
              {/* Banner */}
              <div
                aria-hidden="true"
                className="h-36 bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-700 relative"
              >
                <div
                  className="absolute inset-0 opacity-10"
                  style={{
                    backgroundImage:
                      'radial-gradient(circle at 20% 50%, white 1px, transparent 1px), radial-gradient(circle at 80% 20%, white 1px, transparent 1px)',
                    backgroundSize: '40px 40px',
                  }}
                />
              </div>

              <div className="px-6 sm:px-8 pb-6">
                {/* Logo */}
                <div className="flex items-end justify-between -mt-12 mb-4">
                  <div
                    className="w-24 h-24 rounded-2xl border-4 border-white bg-white shadow-lg flex items-center justify-center overflow-hidden ring-4 ring-blue-50 shrink-0"
                    aria-label={logoUrl ? 'Business logo' : `${firstLetter || '?'} placeholder`}
                  >
                    {logoUrl ? (
                      <img
                        src={logoUrl}
                        alt={`${profileData.businessName} logo`}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="text-3xl font-bold text-blue-600 select-none">
                        {firstLetter || '?'}
                      </span>
                    )}
                  </div>

                  {/* Header action buttons */}
                  <div className="flex items-center gap-2 mt-14">
                    <button
                      type="button"
                      onClick={scrollToQR}
                      aria-label="View QR Code"
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-200 text-xs font-medium text-gray-600 bg-white hover:bg-gray-50 active:scale-95 transition-all focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-1"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 3.5a.5.5 0 11-1 0 .5.5 0 011 0z" />
                      </svg>
                      QR Code
                    </button>
                    <button
                      type="button"
                      onClick={handleShare}
                      aria-label="Share profile"
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 active:scale-95 transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                      </svg>
                      Share
                    </button>
                  </div>
                </div>

                {/* Identity */}
                <div>
                  <h1 className="text-xl sm:text-2xl font-bold text-gray-900 tracking-tight leading-tight">
                    {profileData.businessName}
                  </h1>
                  {profileData.businessCategory && (
                    <span className="mt-1.5 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700">
                      {profileData.businessCategory}
                    </span>
                  )}
                  {profileData.ownerName && (
                    <p className="mt-1.5 text-sm text-gray-500">{profileData.ownerName}</p>
                  )}
                </div>

                {copyMessage && (
                  <p
                    role="status"
                    aria-live="polite"
                    className="mt-3 text-sm text-green-600 font-medium"
                  >
                    {copyMessage}
                  </p>
                )}
              </div>
            </article>

            {/* ── Contact Card ── */}
            {(displayPhone || displayWhatsApp || displayEmail || profileData.website) && (
              <section aria-label="Contact" className={`${cardBase} px-6 sm:px-8 py-6`}>
                <h2 className={sectionHeading}>Contact</h2>

                {/* Action buttons: 2×2 grid */}
                <div className="grid grid-cols-2 gap-3 mb-5" role="group" aria-label="Contact actions">
                  <a
                    href={displayPhone ? `tel:${displayPhone}` : undefined}
                    aria-label="Call business"
                    aria-disabled={!displayPhone}
                    className={`flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 ${
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
                    className={`flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 ${
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
                    className={`flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-500 ${
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

                  {profileData.website ? (
                    <a
                      href={profileData.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label="Open website"
                      className="flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold bg-indigo-600 text-white hover:bg-indigo-700 active:scale-95 transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                    >
                      <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                      </svg>
                      Website
                    </a>
                  ) : (
                    <span
                      aria-disabled="true"
                      className="flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold bg-gray-100 text-gray-400 cursor-not-allowed"
                    >
                      <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                      </svg>
                      Website
                    </span>
                  )}
                </div>

                {/* Contact info rows */}
                <ul className="space-y-3">
                  {displayPhone && (
                    <li className="flex items-center gap-3">
                      <span className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center shrink-0" aria-hidden="true">
                        <svg className="w-3.5 h-3.5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                        </svg>
                      </span>
                      <span className="text-sm text-gray-700">{displayPhone}</span>
                    </li>
                  )}
                  {profileData.whatsappNumber.trim() && (
                    <li className="flex items-center gap-3">
                      <span className="w-8 h-8 rounded-lg bg-green-50 flex items-center justify-center shrink-0" aria-hidden="true">
                        <svg className="w-3.5 h-3.5 text-green-600" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                        </svg>
                      </span>
                      <span className="text-sm text-gray-700">{profileData.whatsappNumber}</span>
                    </li>
                  )}
                  {profileData.email && (
                    <li className="flex items-center gap-3">
                      <span className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center shrink-0" aria-hidden="true">
                        <svg className="w-3.5 h-3.5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                      </span>
                      <span className="text-sm text-gray-700 break-all">{profileData.email}</span>
                    </li>
                  )}
                  {profileData.website && (
                    <li className="flex items-center gap-3">
                      <span className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center shrink-0" aria-hidden="true">
                        <svg className="w-3.5 h-3.5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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

            {/* ── About Card ── */}
            {profileData.aboutBusiness && (
              <section aria-label="About" className={`${cardBase} px-6 sm:px-8 py-6`}>
                <h2 className={sectionHeading}>About</h2>
                <p className="text-sm text-gray-700 leading-relaxed">
                  {profileData.aboutBusiness}
                </p>
              </section>
            )}

            {/* ── Address Card ── */}
            {profileData.address && (
              <section aria-label="Address" className={`${cardBase} px-6 sm:px-8 py-6`}>
                <h2 className={sectionHeading}>Address</h2>
                <div className="flex items-start gap-3">
                  <span className="w-8 h-8 rounded-lg bg-orange-50 flex items-center justify-center shrink-0 mt-0.5" aria-hidden="true">
                    <svg className="w-3.5 h-3.5 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </span>
                  <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">
                    {profileData.address}
                  </p>
                </div>
              </section>
            )}

            {/* ── Business Hours Card ── */}
            {/* TODO: Dynamic business hours will be implemented in a future version */}
            <section aria-label="Business Hours" className={`${cardBase} px-6 sm:px-8 py-6`}>
              <h2 className={sectionHeading}>Business Hours</h2>
              <ul className="space-y-2">
                {[
                  'Monday',
                  'Tuesday',
                  'Wednesday',
                  'Thursday',
                  'Friday',
                  'Saturday',
                  'Sunday',
                ].map((day) => (
                  <li key={day} className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700">{day}</span>
                    <span className="text-sm text-gray-500">9:00 AM – 6:00 PM</span>
                  </li>
                ))}
              </ul>
            </section>

            {/* ── Gallery Card ── */}
            {/* TODO: Dynamic gallery upload will be implemented in a future version */}
            <section aria-label="Gallery" className={`${cardBase} px-6 sm:px-8 py-6`}>
              <h2 className={sectionHeading}>Gallery</h2>
              <div className="grid grid-cols-3 gap-3">
                {[1, 2, 3].map((n) => (
                  <div
                    key={n}
                    className="aspect-square rounded-xl bg-gray-100 flex flex-col items-center justify-center gap-1.5"
                    aria-label={`Photo placeholder ${n}`}
                  >
                    <svg className="w-6 h-6 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <span className="text-xs text-gray-400 font-medium">Photo</span>
                  </div>
                ))}
              </div>
            </section>

            {/* ── QR Code Card ── */}
            <section
              ref={qrSectionRef}
              aria-label="QR Code"
              className={`${cardBase} px-6 sm:px-8 py-8`}
            >
              <div className="text-center mb-6">
                <h2 className="text-sm font-bold text-gray-900 tracking-tight">QR Code</h2>
                <p className="mt-1 text-xs text-gray-500">
                  Scan this QR Code to open this business profile.
                </p>
              </div>
              <div className="flex justify-center">
                <div className="p-4 border-2 border-gray-100 rounded-2xl bg-white">
                  <QRCode
                    value={profileUrl}
                    size={160}
                    bgColor="#ffffff"
                    fgColor="#1e293b"
                    level="M"
                  />
                </div>
              </div>
            </section>

            {/* ── Back to Edit ── */}
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

          </div>
        )}
      </div>
    </div>
  )
}

export default ProfilePreviewPage
