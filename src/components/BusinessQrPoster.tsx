import { forwardRef, useId, useState } from 'react'
import QRCode from 'react-qr-code'

export interface BusinessQrPosterProps {
  businessName: string
  businessLogoUrl: string | null
  profileUrl: string
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

function getBusinessNameLines(value: string): string[] {
  const normalized = value.trim() || 'Your Business Profile'
  if (normalized.length <= 25) return [normalized]

  const words = normalized.split(/\s+/)
  const firstLine: string[] = []

  while (words.length > 0 && `${firstLine.join(' ')} ${words[0]}`.trim().length <= 25) {
    firstLine.push(words.shift() as string)
  }

  if (firstLine.length === 0) {
    firstLine.push(words.shift() as string)
  }

  const secondLine = words.join(' ').trim()
  return secondLine ? [firstLine.join(' '), secondLine] : [firstLine.join(' ')]
}

const BusinessQrPoster = forwardRef<SVGSVGElement, BusinessQrPosterProps>(function BusinessQrPoster(
  { businessName, businessLogoUrl, profileUrl },
  ref
) {
  const [logoErrorSource, setLogoErrorSource] = useState<string | null>(null)
  const posterId = useId().replace(/:/g, '')
  const titleId = `business-qr-poster-title-${posterId}`
  const descriptionId = `business-qr-poster-description-${posterId}`
  const logoClipId = `business-qr-poster-logo-clip-${posterId}`
  const initials = getInitials(businessName)
  const nameLines = getBusinessNameLines(businessName)
  const nameFontSize = nameLines.length === 1 ? 32 : 28
  const nameLineSpacing = 32
  const longestNameLineLength = Math.max(...nameLines.map((line) => line.length))
  const profileUrlFontSize = Math.max(10, Math.min(17, 760 / (Math.max(profileUrl.length, 1) * 0.56)))
  const logoFailed = Boolean(businessLogoUrl && logoErrorSource === businessLogoUrl)

  return (
    <div className="relative mx-auto w-full max-w-[25rem]" style={{ aspectRatio: '1748 / 2480' }}>
      <svg
        ref={ref}
        className="block h-full w-full"
        viewBox="0 0 874 1240"
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-labelledby={`${titleId} ${descriptionId}`}
        xmlns="http://www.w3.org/2000/svg"
      >
        <title id={titleId}>Business QR poster for {businessName}</title>
        <desc id={descriptionId}>Scan the QR code to open the public business profile.</desc>

        <defs>
          <clipPath id={logoClipId}>
            <rect x="373" y="70" width="128" height="128" rx="28" />
          </clipPath>
        </defs>

        <rect x="0" y="0" width="874" height="1240" rx="56" fill="#ffffff" />

        <path d="M560 0h314v300L700 130 560 0Z" fill="#dff4ff" />
        <path d="M874 0v180L760 70 874 0Z" fill="#2563eb" fillOpacity=".2" />
        <circle cx="720" cy="78" r="28" stroke="#0f172a" strokeOpacity=".12" strokeWidth="3" />

        <path d="M0 1240v-250l112 106 106-106 176 250H0Z" fill="#dbeafe" />
        <path d="M0 1240v-126l112-106 106 106-122 126H0Z" fill="#38bdf8" fillOpacity=".24" />
        <path d="m0 1094 72 66" stroke="#0f172a" strokeOpacity=".12" strokeWidth="3" />

        <rect x="373" y="70" width="128" height="128" rx="28" fill="#0f172a" />
        {businessLogoUrl && (
          <image
            data-logo-image="true"
            href={businessLogoUrl}
            x="373"
            y="70"
            width="128"
            height="128"
            clipPath={`url(#${logoClipId})`}
            preserveAspectRatio="xMidYMid meet"
            opacity={logoFailed ? 0 : 1}
            onError={() => setLogoErrorSource(businessLogoUrl)}
          />
        )}
        <g data-logo-fallback="true" opacity={!businessLogoUrl || logoFailed ? 1 : 0}>
          <rect x="373" y="70" width="128" height="128" rx="28" fill="#0f172a" />
          <text
            x="437"
            y="151"
            textAnchor="middle"
            fill="#ffffff"
            fontFamily="Arial, Helvetica, sans-serif"
            fontSize="34"
            fontWeight="700"
            letterSpacing="2"
          >
            {initials}
          </text>
        </g>

        <text
          x="437"
          y="257"
          textAnchor="middle"
          fill="#2563eb"
          fontFamily="Arial, Helvetica, sans-serif"
          fontSize="13"
          fontWeight="800"
          letterSpacing="4"
        >
          VIEW OUR
        </text>
        <text
          x="437"
          y="308"
          textAnchor="middle"
          fill="#0f172a"
          fontFamily="Arial, Helvetica, sans-serif"
          fontSize="24"
          fontWeight="800"
          letterSpacing="1.5"
        >
          BUSINESS PROFILE
        </text>
        <text
          x="437"
          y={nameLines.length === 1 ? 354 : 343}
          textAnchor="middle"
          fill="#475569"
          fontFamily="Arial, Helvetica, sans-serif"
          fontSize={nameFontSize}
          fontWeight="700"
        >
          {nameLines.map((line, index) => (
            <tspan
              key={`${line}-${index}`}
              x="437"
              dy={index === 0 ? 0 : nameLineSpacing}
              textLength={longestNameLineLength > 45 ? 640 : undefined}
              lengthAdjust={longestNameLineLength > 45 ? 'spacingAndGlyphs' : undefined}
            >
              {line}
            </tspan>
          ))}
        </text>

        <rect x="167" y="390" width="540" height="540" rx="40" fill="#ffffff" stroke="#e2e8f0" strokeWidth="2" />
        <g transform="translate(207 430)">
          <QRCode
            value={profileUrl}
            size={460}
            bgColor="#ffffff"
            fgColor="#0f172a"
            level="M"
            data-qr-code="true"
          />
        </g>

        <text
          x="437"
          y="976"
          textAnchor="middle"
          fill="#2563eb"
          fontFamily="Arial, Helvetica, sans-serif"
          fontSize="17"
          fontWeight="800"
          letterSpacing="4"
        >
          SCAN WITH YOUR CAMERA
        </text>
        <text
          x="437"
          y="1025"
          textAnchor="middle"
          fill="#64748b"
          fontFamily="Arial, Helvetica, sans-serif"
          fontSize={profileUrlFontSize}
        >
          {profileUrl}
        </text>
        <line x1="286" y1="1107" x2="588" y2="1107" stroke="#bfdbfe" strokeWidth="3" />
        <circle cx="437" cy="1107" r="7" fill="#2563eb" />
        <text
          x="437"
          y="1176"
          textAnchor="middle"
          fill="#64748b"
          fontFamily="Arial, Helvetica, sans-serif"
          fontSize="20"
          fontWeight="500"
          letterSpacing="1"
        >
          Powered by <tspan fill="#0f172a" fontSize="22" fontWeight="800">Smart Business Profile</tspan>
        </text>
      </svg>
    </div>
  )
})

BusinessQrPoster.displayName = 'BusinessQrPoster'

export default BusinessQrPoster
