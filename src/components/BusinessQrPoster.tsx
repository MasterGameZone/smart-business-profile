import { useState } from 'react'
import type { RefObject } from 'react'
import QRCode from 'react-qr-code'

export interface BusinessQrPosterProps {
  businessName: string
  businessLogoUrl: string | null
  profileUrl: string
  qrCodeRef: RefObject<HTMLDivElement>
}

function getInitials(value: string): string {
  const initials = value
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')

  return initials || 'SB'
}

function BusinessQrPoster({ businessName, businessLogoUrl, profileUrl, qrCodeRef }: BusinessQrPosterProps) {
  const [logoErrorSource, setLogoErrorSource] = useState<string | null>(null)
  const initials = getInitials(businessName)
  const logoFailed = Boolean(businessLogoUrl && logoErrorSource === businessLogoUrl)

  return (
    <article
      aria-labelledby="business-qr-poster-title"
      className="relative mx-auto flex aspect-[2/3] w-full max-w-[25rem] overflow-hidden rounded-[2rem] border border-slate-200 bg-white text-center text-slate-950 shadow-[0_28px_70px_-38px_rgba(15,23,42,0.7)]"
    >
      <svg
        className="pointer-events-none absolute right-0 top-0 h-40 w-40 text-sky-500/15"
        viewBox="0 0 160 160"
        fill="none"
        aria-hidden="true"
      >
        <path d="M70 0h90v90L116 44 70 0Z" fill="currentColor" />
        <path d="M160 34 118 0h42v34Z" fill="#2563eb" fillOpacity=".2" />
        <circle cx="112" cy="28" r="14" stroke="#0f172a" strokeOpacity=".12" strokeWidth="2" />
      </svg>

      <svg
        className="pointer-events-none absolute bottom-0 left-0 h-36 w-36 text-blue-600/15"
        viewBox="0 0 144 144"
        fill="none"
        aria-hidden="true"
      >
        <path d="M0 144V62l42 40 38-38 64 80H0Z" fill="currentColor" />
        <path d="M0 144V102l42-40 38 38-44 44H0Z" fill="#38bdf8" fillOpacity=".24" />
        <path d="m0 94 26 24" stroke="#0f172a" strokeOpacity=".12" strokeWidth="2" />
      </svg>

      <div className="relative z-10 flex h-full min-h-0 w-full flex-col items-center px-6 py-7 sm:px-9 sm:py-9">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-sky-100 bg-slate-950 text-lg font-bold tracking-wide text-white shadow-[0_14px_28px_-18px_rgba(15,23,42,0.9)] sm:h-[4.5rem] sm:w-[4.5rem]">
          {businessLogoUrl && !logoFailed ? (
            <img
              src={businessLogoUrl}
              alt={`${businessName} logo`}
              className="h-full w-full object-cover"
              onError={() => setLogoErrorSource(businessLogoUrl)}
            />
          ) : (
            <span aria-hidden="true">{initials}</span>
          )}
        </div>

        <p className="mt-5 text-[0.65rem] font-extrabold tracking-[0.28em] text-blue-600 sm:text-xs">
          VIEW OUR
        </p>
        <h2
          id="business-qr-poster-title"
          className="mt-1 max-w-[17rem] text-xl font-black uppercase leading-tight tracking-[0.08em] text-slate-950 sm:text-2xl"
        >
          BUSINESS PROFILE
        </h2>
        <p className="mt-2 max-w-[17rem] truncate text-sm font-semibold text-slate-600">{businessName}</p>

        <div className="mt-5 flex min-h-0 w-full justify-center">
          <div className="rounded-[1.35rem] border border-slate-200 bg-white p-4 shadow-[0_18px_36px_-26px_rgba(15,23,42,0.7)] sm:p-5">
            <div ref={qrCodeRef} className="bg-white p-3" aria-label="Business profile QR code">
              <QRCode
                value={profileUrl}
                size={220}
                bgColor="#ffffff"
                fgColor="#0f172a"
                level="M"
                className="block h-auto w-full max-w-[12rem] sm:max-w-[14rem]"
              />
            </div>
          </div>
        </div>

        <p className="mt-4 text-[0.65rem] font-extrabold tracking-[0.25em] text-blue-600 sm:text-xs">
          SCAN WITH YOUR CAMERA
        </p>
        <p className="mt-2 max-w-full break-all px-2 text-[0.6rem] leading-relaxed text-slate-500 sm:text-xs">
          {profileUrl}
        </p>

        <p className="mt-auto pt-4 text-[0.65rem] font-medium tracking-wide text-slate-500 sm:text-xs">
          Powered by <span className="font-bold text-slate-900">Smart Business Profile</span>
        </p>
      </div>
    </article>
  )
}

export default BusinessQrPoster
