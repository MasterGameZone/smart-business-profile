import type { RefObject, ReactNode } from 'react'
import QRCode from 'react-qr-code'

export interface BusinessProfileDisplayData {
  businessName: string
  ownerName: string
  businessCategory: string
  phoneNumber: string
  whatsappNumber: string
  email: string
  website: string
  address: string
  aboutBusiness: string
  logoUrl: string | null
}

interface BusinessProfileDisplayProps {
  profile: BusinessProfileDisplayData
  profileUrl: string
  onShare: () => void
  qrSectionRef: RefObject<HTMLElement>
  qrCodeRef: RefObject<HTMLDivElement>
  onDownloadQR: () => void
  onShareQR: () => void
  saveButtonSlot?: ReactNode
  footerSlot?: ReactNode
}

const cardBase = 'bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden'
const sectionHeading = 'text-xs font-semibold uppercase tracking-widest text-gray-400 mb-4'

function BusinessProfileDisplay({
  profile,
  profileUrl,
  onShare,
  qrSectionRef,
  qrCodeRef,
  onDownloadQR,
  onShareQR,
  saveButtonSlot,
  footerSlot,
}: BusinessProfileDisplayProps) {
  const displayPhone    = profile.phoneNumber.trim()
  const displayWhatsApp = profile.whatsappNumber.trim() || displayPhone
  const displayEmail    = profile.email.trim()
  const firstLetter     = profile.businessName.trim().charAt(0).toUpperCase()

  const scrollToQR = () => {
    qrSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div className="space-y-4">

      {/* ── Header Card ── */}
      <article className={cardBase}>
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
          <div className="flex items-end justify-between -mt-12 mb-4">
            <div
              className="w-24 h-24 rounded-2xl border-4 border-white bg-white shadow-lg flex items-center justify-center overflow-hidden ring-4 ring-blue-50 shrink-0"
              aria-label={profile.logoUrl ? 'Business logo' : `${firstLetter || '?'} placeholder`}
            >
              {profile.logoUrl ? (
                <img src={profile.logoUrl} alt={`${profile.businessName} logo`} className="w-full h-full object-cover" />
              ) : (
                <span className="text-3xl font-bold text-blue-600 select-none">{firstLetter || '?'}</span>
              )}
            </div>

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
                onClick={onShare}
                aria-label="Share profile link"
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 active:scale-95 transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                </svg>
                Share
              </button>
            </div>
          </div>

          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 tracking-tight leading-tight">
              {profile.businessName}
            </h1>
            {profile.businessCategory && (
              <span className="mt-1.5 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700">
                {profile.businessCategory}
              </span>
            )}
            {profile.ownerName && (
              <p className="mt-1.5 text-sm text-gray-500">{profile.ownerName}</p>
            )}
          </div>
        </div>
      </article>

      {/* ── Contact Card ── */}
      {(displayPhone || displayWhatsApp || displayEmail || profile.website) && (
        <section aria-label="Contact" className={`${cardBase} px-6 sm:px-8 py-6`}>
          <h2 className={sectionHeading}>Contact</h2>

          {/* Row 1: Call / WhatsApp / Email */}
          <div className="grid grid-cols-3 gap-3 mb-3" role="group" aria-label="Contact actions">
            <a
              href={displayPhone ? `tel:${displayPhone}` : undefined}
              aria-label="Call business"
              aria-disabled={!displayPhone}
              className={`flex items-center justify-center gap-1.5 py-3 rounded-xl text-sm font-semibold transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 ${
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
              className={`flex items-center justify-center gap-1.5 py-3 rounded-xl text-sm font-semibold transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 ${
                displayWhatsApp
                  ? 'bg-green-600 text-white hover:bg-green-700 active:scale-95'
                  : 'bg-gray-100 text-gray-400 cursor-not-allowed pointer-events-none'
              }`}
            >
              <svg className="w-4 h-4 shrink-0" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
              </svg>
              WA
            </a>

            <a
              href={displayEmail ? `mailto:${displayEmail}` : undefined}
              aria-label="Send email"
              aria-disabled={!displayEmail}
              className={`flex items-center justify-center gap-1.5 py-3 rounded-xl text-sm font-semibold transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-500 ${
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
          </div>

          {/* Row 2: Share Profile / (optional) Save Profile */}
          <div
            className={`grid ${saveButtonSlot ? 'grid-cols-2' : 'grid-cols-1'} gap-3 mb-5`}
            role="group"
            aria-label="Profile actions"
          >
            <button
              type="button"
              onClick={onShare}
              aria-label="Share profile link"
              className="flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold bg-indigo-600 text-white hover:bg-indigo-700 active:scale-95 transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
              </svg>
              Share Profile
            </button>

            {saveButtonSlot}
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
            {profile.whatsappNumber.trim() && (
              <li className="flex items-center gap-3">
                <span className="w-8 h-8 rounded-lg bg-green-50 flex items-center justify-center shrink-0" aria-hidden="true">
                  <svg className="w-3.5 h-3.5 text-green-600" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                  </svg>
                </span>
                <span className="text-sm text-gray-700">{profile.whatsappNumber}</span>
              </li>
            )}
            {profile.email && (
              <li className="flex items-center gap-3">
                <span className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center shrink-0" aria-hidden="true">
                  <svg className="w-3.5 h-3.5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </span>
                <span className="text-sm text-gray-700 break-all">{profile.email}</span>
              </li>
            )}
            {profile.website && (
              <li className="flex items-center gap-3">
                <span className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center shrink-0" aria-hidden="true">
                  <svg className="w-3.5 h-3.5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                  </svg>
                </span>
                <a href={profile.website} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 hover:underline focus:outline-none focus:underline truncate">
                  {profile.website.replace(/^https?:\/\//, '')}
                </a>
              </li>
            )}
          </ul>
        </section>
      )}

      {/* ── About Card ── */}
      {profile.aboutBusiness && (
        <section aria-label="About" className={`${cardBase} px-6 sm:px-8 py-6`}>
          <h2 className={sectionHeading}>About</h2>
          <p className="text-sm text-gray-700 leading-relaxed">{profile.aboutBusiness}</p>
        </section>
      )}

      {/* ── Address Card ── */}
      {profile.address && (
        <section aria-label="Address" className={`${cardBase} px-6 sm:px-8 py-6`}>
          <h2 className={sectionHeading}>Address</h2>
          <div className="flex items-start gap-3">
            <span className="w-8 h-8 rounded-lg bg-orange-50 flex items-center justify-center shrink-0 mt-0.5" aria-hidden="true">
              <svg className="w-3.5 h-3.5 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </span>
            <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">{profile.address}</p>
          </div>
        </section>
      )}

      {/* ── Business Hours Card ── */}
      {/* TODO: Dynamic business hours will be implemented in a future version */}
      <section aria-label="Business Hours" className={`${cardBase} px-6 sm:px-8 py-6`}>
        <h2 className={sectionHeading}>Business Hours</h2>
        <ul className="space-y-2">
          {['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'].map((day) => (
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
            <div key={n} className="aspect-square rounded-xl bg-gray-100 flex flex-col items-center justify-center gap-1.5" aria-label={`Photo placeholder ${n}`}>
              <svg className="w-6 h-6 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span className="text-xs text-gray-400 font-medium">Photo</span>
            </div>
          ))}
        </div>
      </section>

      {/* ── QR Code Card ── */}
      <section ref={qrSectionRef} aria-label="QR Code" className={`${cardBase} px-6 sm:px-8 py-8`}>
        <div className="text-center mb-6">
          <h2 className="text-sm font-bold text-gray-900 tracking-tight">QR Code</h2>
          <p className="mt-1 text-xs text-gray-500">Scan this QR Code to open this business profile.</p>
        </div>

        <div className="flex justify-center mb-6">
          <div ref={qrCodeRef} className="p-4 border-2 border-gray-100 rounded-2xl bg-white">
            <QRCode
              value={profileUrl}
              size={160}
              bgColor="#ffffff"
              fgColor="#1e293b"
              level="M"
            />
          </div>
        </div>

        {/* QR actions */}
        <div className="grid grid-cols-2 gap-3" role="group" aria-label="QR Code actions">
          <button
            type="button"
            onClick={onDownloadQR}
            aria-label="Download QR Code as PNG"
            className="flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold bg-gray-900 text-white hover:bg-gray-800 active:scale-95 transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-700"
          >
            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Download QR
          </button>

          <button
            type="button"
            onClick={onShareQR}
            aria-label="Share QR Code image"
            className="flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold bg-violet-600 text-white hover:bg-violet-700 active:scale-95 transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-violet-500"
          >
            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
            </svg>
            Share QR
          </button>
        </div>
      </section>

      {footerSlot}

    </div>
  )
}

export default BusinessProfileDisplay
