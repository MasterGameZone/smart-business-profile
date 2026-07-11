import { useEffect, useRef, useState, type ReactNode, type RefObject } from 'react'
import QRCode from 'react-qr-code'
import type { BusinessProfileRow, JsonObject, SocialLinks } from '../types/businessProfile.ts'

export interface BusinessProfileDisplayData {
  businessName: string
  ownerName: string
  businessCategory: string
  established_year?: BusinessProfileRow['established_year']
  years_of_experience?: BusinessProfileRow['years_of_experience']
  products_menu_packages?: BusinessProfileRow['products_menu_packages']
  faqs?: BusinessProfileRow['faqs']
  qualifications?: BusinessProfileRow['qualifications']
  ratingAverage?: number | null
  ratingCount?: number | null
  phoneNumber: string
  whatsappNumber: string
  email: string
  website: string
  address: string
  aboutBusiness: string
  logoUrl: string | null
  coverBannerUrl?: string | null
  tagline?: string | null
  services?: unknown[] | null
  workingHours?: JsonObject | null
  googleMapsUrl?: string | null
  socialLinks?: SocialLinks | null
  keywords?: string[] | null
  galleryImages?: string[] | null
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
const workingDayLabels = [
  { key: 'monday', label: 'Monday' },
  { key: 'tuesday', label: 'Tuesday' },
  { key: 'wednesday', label: 'Wednesday' },
  { key: 'thursday', label: 'Thursday' },
  { key: 'friday', label: 'Friday' },
  { key: 'saturday', label: 'Saturday' },
  { key: 'sunday', label: 'Sunday' },
] as const
function trimText(value: string | null | undefined): string {
  return typeof value === 'string' ? value.trim() : ''
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function toValidUrl(value: string | null | undefined): string | null {
  const trimmed = trimText(value)
  if (!trimmed) return null

  try {
    const url = new URL(trimmed)
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : null
  } catch {
    return null
  }
}

function toDisplayImageUrl(value: string | null | undefined): string | null {
  const trimmed = trimText(value)
  if (!trimmed) return null

  try {
    const url = new URL(trimmed)
    return ['http:', 'https:', 'blob:'].includes(url.protocol) ? trimmed : null
  } catch {
    return null
  }
}

function normalizeStringArray(value: unknown[] | string[] | null | undefined): string[] {
  if (!Array.isArray(value)) return []

  return value.reduce<string[]>((items, item) => {
    if (typeof item !== 'string') return items

    const trimmed = item.trim()
    if (trimmed) {
      items.push(trimmed)
    }

    return items
  }, [])
}

function normalizeProductOfferings(value: BusinessProfileDisplayData['products_menu_packages']): DisplayOfferingItem[] {
  if (!Array.isArray(value)) return []

  return value.reduce<DisplayOfferingItem[]>((items, item, index) => {
    if (!item || typeof item !== 'object') return items

    const name = trimText(item.name)
    const price = trimText(item.price)
    if (!name || !price) return items

    const description = trimText(item.description)
    const imageUrl = toDisplayImageUrl(item.imageUrl)
    items.push({
      key: `product-${name}-${price}-${imageUrl ?? index}`,
      name,
      description,
      price,
      imageUrl,
      isLegacy: false,
    })

    return items
  }, [])
}

function normalizeOfferingItems(
  products: BusinessProfileDisplayData['products_menu_packages'],
  services: unknown[] | string[] | null | undefined
): DisplayOfferingItem[] {
  const productOfferings = normalizeProductOfferings(products)
  if (productOfferings.length > 0) return productOfferings

  return normalizeStringArray(services).map((service, index) => ({
    key: `legacy-service-${service}-${index}`,
    name: service,
    description: '',
    price: '',
    imageUrl: null,
    isLegacy: true,
  }))
}

function getOfferingEnquiryUrl(itemName: string, whatsappNumber: string, phoneNumber: string): string | null {
  const whatsappDigits = whatsappNumber.replace(/\D/g, '')
  if (whatsappDigits) {
    return `https://wa.me/${whatsappDigits}?text=${encodeURIComponent(`Hi, I would like to enquire about ${itemName}.`)}`
  }

  const phone = trimText(phoneNumber)
  return phone ? `tel:${phone}` : null
}

function normalizeWorkingHours(value: JsonObject | null | undefined): Array<{ day: string; hours: string }> {
  if (!isRecord(value)) return []

  const hours: Array<{ day: string; hours: string }> = []

  for (const { key, label } of workingDayLabels) {
    const dayValue = value[key]
    if (!isRecord(dayValue)) continue

    const closed = dayValue.closed === true
    const open = trimText(typeof dayValue.open === 'string' ? dayValue.open : '')
    const close = trimText(typeof dayValue.close === 'string' ? dayValue.close : '')

    if (closed) {
      hours.push({ day: label, hours: 'Closed' })
      continue
    }

    if (open && close) {
      hours.push({ day: label, hours: `${open} - ${close}` })
    }
  }

  return hours
}

interface CompactWorkingStatus {
  label: string
  detail: string
  tone: 'open' | 'closed' | 'unknown'
}

interface DisplayOfferingItem {
  key: string
  name: string
  description: string
  price: string
  imageUrl: string | null
  isLegacy: boolean
}

function getBusinessInitials(value: string): string {
  const words = value
    .trim()
    .split(/\s+/)
    .filter(Boolean)

  if (words.length === 0) return '?'

  return words
    .slice(0, 2)
    .map((word) => word.charAt(0).toUpperCase())
    .join('')
}

function formatClockTime(value: string): string {
  const trimmed = value.trim()
  const match = /^(\d{1,2}):(\d{2})$/.exec(trimmed)
  if (!match) return trimmed

  const hour = Number(match[1])
  const minute = Number(match[2])
  if (!Number.isInteger(hour) || !Number.isInteger(minute)) return trimmed

  const period = hour >= 12 ? 'PM' : 'AM'
  const displayHour = hour % 12 || 12
  return `${displayHour}:${String(minute).padStart(2, '0')} ${period}`
}

function timeToMinutes(value: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim())
  if (!match) return null

  const hour = Number(match[1])
  const minute = Number(match[2])
  if (!Number.isInteger(hour) || !Number.isInteger(minute) || hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    return null
  }

  return hour * 60 + minute
}

function isWithinWorkingWindow(now: number, open: number, close: number): boolean {
  if (open === close) return false
  if (open < close) return now >= open && now < close

  return now >= open || now < close
}

function getNextOpenDetail(value: JsonObject, startIndex: number): string {
  for (let offset = 1; offset <= workingDayLabels.length; offset += 1) {
    const dayIndex = (startIndex + offset) % workingDayLabels.length
    const day = workingDayLabels[dayIndex]
    const dayValue = value[day.key]
    if (!isRecord(dayValue) || dayValue.closed === true) continue

    const open = trimText(typeof dayValue.open === 'string' ? dayValue.open : '')
    if (open) {
      return `Opens ${day.label.slice(0, 3)} ${formatClockTime(open)}`
    }
  }

  return ''
}

function getCompactWorkingStatus(value: JsonObject | null | undefined): CompactWorkingStatus {
  if (!isRecord(value)) {
    return { label: 'Hours unavailable', detail: '', tone: 'unknown' }
  }

  const now = new Date()
  const todayIndex = now.getDay() === 0 ? 6 : now.getDay() - 1
  const today = workingDayLabels[todayIndex]
  const todayValue = value[today.key]

  if (!isRecord(todayValue)) {
    return { label: 'Hours unavailable', detail: '', tone: 'unknown' }
  }

  const open = trimText(typeof todayValue.open === 'string' ? todayValue.open : '')
  const close = trimText(typeof todayValue.close === 'string' ? todayValue.close : '')

  if (todayValue.closed === true) {
    return {
      label: 'Closed',
      detail: getNextOpenDetail(value, todayIndex),
      tone: 'closed',
    }
  }

  if (!open || !close) {
    return { label: 'Hours unavailable', detail: '', tone: 'unknown' }
  }

  const openMinutes = timeToMinutes(open)
  const closeMinutes = timeToMinutes(close)
  const nowMinutes = now.getHours() * 60 + now.getMinutes()

  if (openMinutes === null || closeMinutes === null) {
    return { label: 'Open today', detail: `${formatClockTime(open)} - ${formatClockTime(close)}`, tone: 'unknown' }
  }

  if (isWithinWorkingWindow(nowMinutes, openMinutes, closeMinutes)) {
    return { label: 'Open', detail: `Closes at ${formatClockTime(close)}`, tone: 'open' }
  }

  if (nowMinutes < openMinutes) {
    return { label: 'Closed', detail: `Opens at ${formatClockTime(open)}`, tone: 'closed' }
  }

  return {
    label: 'Closed',
    detail: getNextOpenDetail(value, todayIndex),
    tone: 'closed',
  }
}

function formatBusinessExperience(profile: BusinessProfileDisplayData): string {
  if (typeof profile.established_year === 'number' && Number.isFinite(profile.established_year)) {
    return `Established ${profile.established_year}`
  }

  if (typeof profile.years_of_experience === 'number' && Number.isFinite(profile.years_of_experience)) {
    return `${profile.years_of_experience}+ years experience`
  }

  return ''
}

function formatCompactLocation(value: string): string {
  const firstLine = trimText(value).split(/\r?\n/).find(Boolean) ?? ''
  if (!firstLine) return ''

  const parts = firstLine
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)

  return parts.length > 1 ? parts.slice(0, 2).join(', ') : firstLine
}

function toDirectionsUrl(googleMapsUrl: string | null, address: string): string | null {
  if (googleMapsUrl) return googleMapsUrl

  const trimmedAddress = trimText(address)
  if (!trimmedAddress) return null

  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(trimmedAddress)}`
}

function toSocialPlatformLabel(value: string): string {
  const trimmed = trimText(value)
  if (!trimmed) return ''

  switch (trimmed.toLowerCase()) {
    case 'facebook':
      return 'Facebook'
    case 'instagram':
      return 'Instagram'
    case 'linkedin':
      return 'LinkedIn'
    case 'youtube':
      return 'YouTube'
    case 'x':
    case 'twitter':
    case 'x / twitter':
      return 'X / Twitter'
    default:
      return trimmed
  }
}

function normalizeSocialLinks(value: SocialLinks | null | undefined): Array<{ label: string; url: string }> {
  if (!isRecord(value)) return []

  const links: Array<{ label: string; url: string }> = []

  for (const [key, entryValue] of Object.entries(value)) {
    const label = toSocialPlatformLabel(key)
    const url = typeof entryValue === 'string' ? toValidUrl(entryValue) : null

    if (label && url) {
      links.push({ label, url })
    }
  }

  return links
}

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
  const [isExpanded, setIsExpanded] = useState(false)
  const [logoFailed, setLogoFailed] = useState(false)
  const compactCardRef = useRef<HTMLElement>(null)
  const displayPhone = trimText(profile.phoneNumber)
  const displayWhatsApp = trimText(profile.whatsappNumber) || displayPhone
  const displayRawWhatsApp = trimText(profile.whatsappNumber)
  const displayEmail = trimText(profile.email)
  const displayWebsite = trimText(profile.website)
  const displayAddress = trimText(profile.address)
  const displayTagline = trimText(profile.tagline)
  const coverBannerUrl = toDisplayImageUrl(profile.coverBannerUrl)
  const displayLogoUrl = logoFailed ? null : toDisplayImageUrl(profile.logoUrl)
  const businessInitials = getBusinessInitials(profile.businessName)
  const offeringItems = normalizeOfferingItems(profile.products_menu_packages, profile.services)
  const workingHours = normalizeWorkingHours(profile.workingHours)
  const googleMapsUrl = toValidUrl(profile.googleMapsUrl)
  const directionsUrl = toDirectionsUrl(googleMapsUrl, displayAddress)
  const socialLinks = normalizeSocialLinks(profile.socialLinks)
  const keywordItems = normalizeStringArray(profile.keywords)
  const galleryItems = normalizeStringArray(profile.galleryImages)
    .map(toDisplayImageUrl)
    .filter((url): url is string => Boolean(url))
  const compactLocation = formatCompactLocation(displayAddress)
  const workingStatus = getCompactWorkingStatus(profile.workingHours)
  const experienceText = formatBusinessExperience(profile)
  const whatsappDigits = displayWhatsApp.replace(/\D/g, '')
  const whatsappUrl = whatsappDigits ? `https://wa.me/${whatsappDigits}` : null
  const hasRating = typeof profile.ratingAverage === 'number' && Number.isFinite(profile.ratingAverage) && Boolean(profile.ratingCount)
  const hasAboutSection = Boolean(profile.aboutBusiness || keywordItems.length > 0)
  const offeringSectionLabel = 'Services'

  useEffect(() => {
    setLogoFailed(false)
  }, [profile.logoUrl])

  const scrollToQR = () => {
    qrSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const handleHideFullProfile = () => {
    setIsExpanded(false)
    requestAnimationFrame(() => {
      compactCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }

  return (
    <div className="space-y-4">
      <article
        ref={compactCardRef}
        className="overflow-hidden rounded-[1.75rem] border border-white/80 bg-white shadow-[0_24px_70px_-36px_rgba(15,23,42,0.55)]"
      >
        <div className="relative h-40 bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-700">
          {coverBannerUrl ? (
            <img
              src={coverBannerUrl}
              alt={`${profile.businessName} cover banner`}
              className="h-full w-full object-cover"
              onError={(event) => {
                event.currentTarget.style.display = 'none'
              }}
            />
          ) : (
            <div
              aria-hidden="true"
              className="absolute inset-0 opacity-10"
              style={{
                backgroundImage:
                  'radial-gradient(circle at 20% 50%, white 1px, transparent 1px), radial-gradient(circle at 80% 20%, white 1px, transparent 1px)',
                backgroundSize: '40px 40px',
              }}
            />
          )}
          <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/25 to-transparent" />
        </div>

        <div className="px-4 pb-4 sm:px-5">
          <div className="-mt-11 flex items-end justify-between gap-3">
            <div
              className="relative flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-full border-4 border-white bg-white shadow-xl ring-1 ring-slate-100"
              aria-label={displayLogoUrl ? 'Business logo' : `${businessInitials} logo placeholder`}
            >
              {displayLogoUrl ? (
                <img
                  src={displayLogoUrl}
                  alt={`${profile.businessName} logo`}
                  className="h-full w-full object-cover"
                  onError={() => setLogoFailed(true)}
                />
              ) : (
                <span className="select-none text-2xl font-bold text-blue-700">{businessInitials}</span>
              )}
            </div>
          </div>

          <div className="mt-3 flex min-w-0 items-center gap-2">
            <h1 className="min-w-0 flex-1 truncate text-2xl font-bold leading-tight tracking-tight text-slate-950">
              {profile.businessName}
            </h1>
            {hasRating && (
              <span
                className="inline-flex shrink-0 items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700 ring-1 ring-amber-100"
                aria-label={`${profile.ratingAverage?.toFixed(1)} out of 5 average rating`}
              >
                <svg className="h-3.5 w-3.5 fill-current" viewBox="0 0 20 20" aria-hidden="true">
                  <path d="M9.05 2.93c.3-.92 1.6-.92 1.9 0l1.18 3.63a1 1 0 0 0 .95.69h3.82c.97 0 1.37 1.24.59 1.81l-3.09 2.24a1 1 0 0 0-.36 1.12l1.18 3.63c.3.92-.76 1.69-1.54 1.12l-3.09-2.24a1 1 0 0 0-1.18 0l-3.09 2.24c-.78.57-1.84-.2-1.54-1.12l1.18-3.63a1 1 0 0 0-.36-1.12L2.51 9.06c-.78-.57-.38-1.81.59-1.81h3.82a1 1 0 0 0 .95-.69l1.18-3.63z" />
                </svg>
                {profile.ratingAverage?.toFixed(1)}
              </span>
            )}
          </div>

          {profile.businessCategory && (
            <div className="mt-2">
              <span className="inline-flex max-w-full items-center rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700 ring-1 ring-blue-100">
                <span className="truncate">{profile.businessCategory}</span>
              </span>
            </div>
          )}

          {displayTagline && (
            <p className="mt-2 text-sm italic leading-relaxed text-slate-500">{displayTagline}</p>
          )}

          {experienceText && (
            <p className="mt-2 flex items-center gap-1.5 text-sm font-medium text-slate-700">
              <svg className="h-4 w-4 shrink-0 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 3l1.88 5.77h6.07l-4.91 3.57 1.88 5.77L12 14.54l-4.91 3.57 1.88-5.77-4.91-3.57h6.07L12 3z" />
              </svg>
              <span className="truncate">{experienceText}</span>
            </p>
          )}

          <div className="mt-3 flex min-w-0 items-center overflow-hidden whitespace-nowrap rounded-2xl border border-slate-100 bg-slate-50 px-3 py-2 text-[11px] text-slate-600 sm:text-xs">
            <span className="flex min-w-0 flex-1 items-center gap-1.5">
              <svg className="h-3.5 w-3.5 shrink-0 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span className="min-w-0 truncate">{compactLocation || 'Location not added'}</span>
            </span>
            <span className="mx-2 h-3 w-px shrink-0 bg-slate-200" aria-hidden="true" />
            <span
              className={`flex shrink-0 items-center gap-1 font-semibold ${
                workingStatus.tone === 'open'
                  ? 'text-emerald-600'
                  : workingStatus.tone === 'closed'
                    ? 'text-rose-600'
                    : 'text-slate-500'
              }`}
            >
              <span
                className={`h-2 w-2 shrink-0 rounded-full ${
                  workingStatus.tone === 'open'
                    ? 'bg-emerald-500'
                    : workingStatus.tone === 'closed'
                      ? 'bg-rose-500'
                      : 'bg-slate-400'
                }`}
                aria-hidden="true"
              />
              {workingStatus.label}
            </span>
            {workingStatus.detail && (
              <>
                <span className="mx-2 h-3 w-px shrink-0 bg-slate-200" aria-hidden="true" />
                <span className="min-w-0 truncate text-slate-500">{workingStatus.detail}</span>
              </>
            )}
          </div>

          <div className="mt-4 grid grid-cols-4 gap-2" role="group" aria-label="Primary profile actions">
            <a
              href={displayPhone ? `tel:${displayPhone}` : undefined}
              aria-label="Call business"
              aria-disabled={!displayPhone}
              className={`flex min-w-0 flex-col items-center justify-center gap-1.5 rounded-2xl border px-1 py-3 text-xs font-semibold transition focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                displayPhone
                  ? 'border-blue-100 bg-blue-50 text-blue-700 hover:bg-blue-100 active:scale-95'
                  : 'pointer-events-none cursor-not-allowed border-slate-100 bg-slate-50 text-slate-300'
              }`}
            >
              <svg className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
              </svg>
              <span className="max-w-full truncate">Call</span>
            </a>

            <a
              href={whatsappUrl ?? undefined}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Open WhatsApp"
              aria-disabled={!whatsappUrl}
              className={`flex min-w-0 flex-col items-center justify-center gap-1.5 rounded-2xl border px-1 py-3 text-xs font-semibold transition focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 ${
                whatsappUrl
                  ? 'border-emerald-100 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 active:scale-95'
                  : 'pointer-events-none cursor-not-allowed border-slate-100 bg-slate-50 text-slate-300'
              }`}
            >
              <svg className="h-5 w-5 shrink-0" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
              </svg>
              <span className="max-w-full truncate">WhatsApp</span>
            </a>

            <a
              href={directionsUrl ?? undefined}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Open directions"
              aria-disabled={!directionsUrl}
              className={`flex min-w-0 flex-col items-center justify-center gap-1.5 rounded-2xl border px-1 py-3 text-xs font-semibold transition focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ${
                directionsUrl
                  ? 'border-indigo-100 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 active:scale-95'
                  : 'pointer-events-none cursor-not-allowed border-slate-100 bg-slate-50 text-slate-300'
              }`}
            >
              <svg className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 21l7-18-18 7 8 4 3 7z" />
              </svg>
              <span className="max-w-full truncate">Directions</span>
            </a>

            <button
              type="button"
              onClick={onShare}
              aria-label="Share profile link"
              className="flex min-w-0 flex-col items-center justify-center gap-1.5 rounded-2xl border border-amber-100 bg-amber-50 px-1 py-3 text-xs font-semibold text-amber-700 transition hover:bg-amber-100 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 active:scale-95"
            >
              <svg className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
              </svg>
              <span className="max-w-full truncate">Share</span>
            </button>
          </div>

          {!isExpanded && (
            <button
              type="button"
              onClick={() => setIsExpanded(true)}
              aria-expanded={isExpanded}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-700 focus:ring-offset-2 active:scale-[0.99]"
            >
              View Full Profile
              <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          )}
        </div>
      </article>

      <div
        className={`grid transition-[grid-template-rows,opacity,visibility] duration-500 ease-in-out ${
          isExpanded ? 'visible grid-rows-[1fr] opacity-100' : 'invisible grid-rows-[0fr] opacity-0'
        }`}
        aria-hidden={!isExpanded}
      >
        <div className="overflow-hidden">
          <div className="space-y-4 pt-4">
      <article className={cardBase}>
        <div className="relative h-36 bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-700">
          {coverBannerUrl ? (
            <img
              src={coverBannerUrl}
              alt={`${profile.businessName} cover banner`}
              className="h-full w-full object-cover"
              onError={(event) => {
                event.currentTarget.style.display = 'none'
              }}
            />
          ) : (
            <div
              aria-hidden="true"
              className="absolute inset-0 opacity-10"
              style={{
                backgroundImage:
                  'radial-gradient(circle at 20% 50%, white 1px, transparent 1px), radial-gradient(circle at 80% 20%, white 1px, transparent 1px)',
                backgroundSize: '40px 40px',
              }}
            />
          )}
        </div>

        <div className="px-6 pb-6 sm:px-8">
          <div className="-mt-12 mb-4 flex items-end justify-between">
            <div
              className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-2xl border-4 border-white bg-white shadow-lg ring-4 ring-blue-50"
              aria-label={displayLogoUrl ? 'Business logo' : `${businessInitials} placeholder`}
            >
              {displayLogoUrl ? (
                <img
                  src={displayLogoUrl}
                  alt={`${profile.businessName} logo`}
                  className="h-full w-full object-cover"
                  onError={() => setLogoFailed(true)}
                />
              ) : (
                <span className="select-none text-3xl font-bold text-blue-600">{businessInitials}</span>
              )}
            </div>

            <div className="mt-14 flex items-center gap-2">
              <button
                type="button"
                onClick={scrollToQR}
                aria-label="View QR Code"
                className="flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-600 transition-all hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-1 active:scale-95"
              >
                <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 3.5a.5.5 0 11-1 0 .5.5 0 011 0z" />
                </svg>
                QR Code
              </button>
              <button
                type="button"
                onClick={onShare}
                aria-label="Share profile link"
                className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-3 py-2 text-xs font-semibold text-white transition-all hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 active:scale-95"
              >
                <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                </svg>
                Share
              </button>
            </div>
          </div>

          <div>
            <h1 className="text-xl font-bold leading-tight tracking-tight text-gray-900 sm:text-2xl">
              {profile.businessName}
            </h1>
            {displayTagline && (
              <p className="mt-2 text-sm leading-relaxed text-gray-600">{displayTagline}</p>
            )}
            {profile.businessCategory && (
              <span className="mt-1.5 inline-flex items-center rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700">
                {profile.businessCategory}
              </span>
            )}
            {profile.ownerName && <p className="mt-1.5 text-sm text-gray-500">{profile.ownerName}</p>}
          </div>
        </div>
      </article>

      {(displayPhone || displayWhatsApp || displayEmail || displayWebsite) && (
        <section aria-label="Contact" className={`${cardBase} px-6 py-6 sm:px-8`}>
          <h2 className={sectionHeading}>Contact</h2>

          <div className="mb-3 grid grid-cols-3 gap-3" role="group" aria-label="Contact actions">
            <a
              href={displayPhone ? `tel:${displayPhone}` : undefined}
              aria-label="Call business"
              aria-disabled={!displayPhone}
              className={`flex items-center justify-center gap-1.5 rounded-xl py-3 text-sm font-semibold transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                displayPhone
                  ? 'bg-blue-600 text-white hover:bg-blue-700 active:scale-95'
                  : 'pointer-events-none cursor-not-allowed bg-gray-100 text-gray-400'
              }`}
            >
              <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
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
              className={`flex items-center justify-center gap-1.5 rounded-xl py-3 text-sm font-semibold transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 ${
                displayWhatsApp
                  ? 'bg-green-600 text-white hover:bg-green-700 active:scale-95'
                  : 'pointer-events-none cursor-not-allowed bg-gray-100 text-gray-400'
              }`}
            >
              <svg className="h-4 w-4 shrink-0" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
              </svg>
              WA
            </a>

            <a
              href={displayEmail ? `mailto:${displayEmail}` : undefined}
              aria-label="Send email"
              aria-disabled={!displayEmail}
              className={`flex items-center justify-center gap-1.5 rounded-xl py-3 text-sm font-semibold transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2 ${
                displayEmail
                  ? 'bg-slate-700 text-white hover:bg-slate-800 active:scale-95'
                  : 'pointer-events-none cursor-not-allowed bg-gray-100 text-gray-400'
              }`}
            >
              <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              Email
            </a>
          </div>

          <div
            className={`mb-5 grid ${saveButtonSlot ? 'grid-cols-2' : 'grid-cols-1'} gap-3`}
            role="group"
            aria-label="Profile actions"
          >
            <button
              type="button"
              onClick={onShare}
              aria-label="Share profile link"
              className="flex items-center justify-center gap-2 rounded-xl bg-indigo-600 py-3 text-sm font-semibold text-white transition-all hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 active:scale-95"
            >
              <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
              </svg>
              Share Profile
            </button>

            {saveButtonSlot}
          </div>

          <ul className="space-y-3">
            {displayPhone && (
              <li className="flex items-center gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-50" aria-hidden="true">
                  <svg className="h-3.5 w-3.5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                </span>
                <span className="text-sm text-gray-700">{displayPhone}</span>
              </li>
            )}
            {displayRawWhatsApp && (
              <li className="flex items-center gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-green-50" aria-hidden="true">
                  <svg className="h-3.5 w-3.5 text-green-600" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                  </svg>
                </span>
                <span className="text-sm text-gray-700">{displayRawWhatsApp}</span>
              </li>
            )}
            {displayEmail && (
              <li className="flex items-center gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100" aria-hidden="true">
                  <svg className="h-3.5 w-3.5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </span>
                <span className="break-all text-sm text-gray-700">{displayEmail}</span>
              </li>
            )}
            {displayWebsite && (
              <li className="flex items-center gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-50" aria-hidden="true">
                  <svg className="h-3.5 w-3.5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                  </svg>
                </span>
                <a
                  href={displayWebsite}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="truncate text-sm text-blue-600 hover:underline focus:outline-none focus:underline"
                >
                  {displayWebsite.replace(/^https?:\/\//, '')}
                </a>
              </li>
            )}
          </ul>
        </section>
      )}

      {hasAboutSection && (
        <section aria-label="About Us" className="overflow-hidden rounded-3xl border border-slate-100 bg-white px-5 py-6 shadow-sm sm:px-8">
          <div className="mb-4 flex items-center justify-between gap-4">
            <h2 className="text-lg font-bold tracking-tight text-slate-950">About Us</h2>
          </div>

          {profile.aboutBusiness && (
            <p className="whitespace-pre-line text-sm leading-7 text-slate-700">{profile.aboutBusiness}</p>
          )}

          {keywordItems.length > 0 && (
            <div className={profile.aboutBusiness ? 'mt-5' : ''}>
              <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-400">
                Business Keywords / Tags
              </p>
              <ul className="flex flex-wrap gap-2">
                {keywordItems.map((keyword) => (
                  <li
                    key={keyword}
                    className="inline-flex max-w-full items-center rounded-full border border-blue-100 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700"
                  >
                    <span className="truncate">{keyword}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}

      {offeringItems.length > 0 && (
        <section aria-label={offeringSectionLabel} className="overflow-hidden rounded-3xl border border-slate-100 bg-white py-6 shadow-sm">
          <div className="px-5 sm:px-8">
            <h2 className="text-lg font-bold tracking-tight text-slate-950">{offeringSectionLabel}</h2>
          </div>

          <div className="mt-4 overflow-x-auto px-5 pb-1 sm:px-8">
            <ul className="flex gap-3">
              {offeringItems.map((item) => {
                const enquiryUrl = getOfferingEnquiryUrl(item.name, displayRawWhatsApp, displayPhone)

                return (
                  <li
                    key={item.key}
                    className="flex w-[16.5rem] shrink-0 flex-col overflow-hidden rounded-2xl border border-slate-100 bg-slate-50/70"
                  >
                    {item.imageUrl && (
                      <img
                        src={item.imageUrl}
                        alt={`${item.name} image`}
                        className="aspect-[4/3] w-full bg-slate-100 object-cover"
                        loading="lazy"
                        onError={(event) => {
                          event.currentTarget.style.display = 'none'
                        }}
                      />
                    )}

                    <div className="flex flex-1 flex-col p-4">
                      <div className="flex-1">
                        <h3 className="line-clamp-2 text-sm font-bold leading-snug text-slate-950">{item.name}</h3>
                        {item.description && (
                          <p className="mt-2 line-clamp-3 text-xs leading-5 text-slate-500">{item.description}</p>
                        )}
                      </div>

                      <div className="mt-4 flex items-center justify-between gap-3">
                        {item.price ? (
                          <p className="min-w-0 truncate text-sm font-bold text-slate-900">{item.price}</p>
                        ) : (
                          <p className="min-w-0 truncate text-xs font-semibold uppercase tracking-wide text-slate-400">
                            Service
                          </p>
                        )}
                        {enquiryUrl && (
                          <a
                            href={enquiryUrl}
                            target={enquiryUrl.startsWith('https://') ? '_blank' : undefined}
                            rel={enquiryUrl.startsWith('https://') ? 'noopener noreferrer' : undefined}
                            className="shrink-0 rounded-full bg-slate-950 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-700 focus:ring-offset-2"
                          >
                            Enquire
                          </a>
                        )}
                      </div>
                    </div>
                  </li>
                )
              })}
            </ul>
          </div>
        </section>
      )}

      {galleryItems.length > 0 && (
        <section aria-label="Gallery" className="overflow-hidden rounded-3xl border border-slate-100 bg-white py-6 shadow-sm">
          <div className="px-5 sm:px-8">
            <h2 className="text-lg font-bold tracking-tight text-slate-950">Gallery</h2>
          </div>

          <div className="mt-4 overflow-x-auto px-5 pb-1 sm:px-8">
            <div className="flex gap-3">
              {galleryItems.map((imageUrl, index) => (
                <img
                  key={imageUrl}
                  src={imageUrl}
                  alt={`${profile.businessName} gallery image ${index + 1}`}
                  className="h-28 w-28 shrink-0 rounded-2xl border border-slate-100 bg-slate-50 object-cover sm:h-32 sm:w-32"
                  loading="lazy"
                  onError={(event) => {
                    event.currentTarget.style.display = 'none'
                  }}
                />
              ))}
            </div>
          </div>
        </section>
      )}

      {workingHours.length > 0 && (
        <section aria-label="Working Hours" className={`${cardBase} px-6 py-6 sm:px-8`}>
          <h2 className={sectionHeading}>Working Hours</h2>
          <ul className="space-y-2">
            {workingHours.map(({ day, hours }) => (
              <li key={day} className="flex items-center justify-between gap-4">
                <span className="text-sm font-medium text-gray-700">{day}</span>
                <span className="text-right text-sm text-gray-500">{hours}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {(displayAddress || googleMapsUrl) && (
        <section aria-label="Location" className={`${cardBase} px-6 py-6 sm:px-8`}>
          <h2 className={sectionHeading}>Location</h2>
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-orange-50" aria-hidden="true">
              <svg className="h-3.5 w-3.5 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </span>
            <div className="space-y-3">
              {displayAddress && (
                <p className="whitespace-pre-line text-sm leading-relaxed text-gray-700">{displayAddress}</p>
              )}
              {googleMapsUrl && (
                <a
                  href={googleMapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-700 hover:underline focus:outline-none focus:underline"
                >
                  View on Google Maps
                </a>
              )}
            </div>
          </div>
        </section>
      )}

      {socialLinks.length > 0 && (
        <section aria-label="Connect Online" className={`${cardBase} px-6 py-6 sm:px-8`}>
          <h2 className={sectionHeading}>Connect Online</h2>
          <div className="flex flex-wrap gap-3">
            {socialLinks.map(({ label, url }) => (
              <a
                key={label}
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              >
                {label}
              </a>
            ))}
          </div>
        </section>
      )}

      <section ref={qrSectionRef} aria-label="QR Code" className={`${cardBase} px-6 py-8 sm:px-8`}>
        <div className="mb-6 text-center">
          <h2 className="text-sm font-bold tracking-tight text-gray-900">QR Code</h2>
          <p className="mt-1 text-xs text-gray-500">Scan this QR Code to open this business profile.</p>
        </div>

        <div className="mb-6 flex justify-center">
          <div ref={qrCodeRef} className="rounded-2xl border-2 border-gray-100 bg-white p-4">
            <QRCode value={profileUrl} size={160} bgColor="#ffffff" fgColor="#1e293b" level="M" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3" role="group" aria-label="QR Code actions">
          <button
            type="button"
            onClick={onDownloadQR}
            aria-label="Download QR Code as PNG"
            className="flex items-center justify-center gap-2 rounded-xl bg-gray-900 py-3 text-sm font-semibold text-white transition-all hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-700 focus:ring-offset-2 active:scale-95"
          >
            <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Download QR
          </button>

          <button
            type="button"
            onClick={onShareQR}
            aria-label="Share QR Code image"
            className="flex items-center justify-center gap-2 rounded-xl bg-violet-600 py-3 text-sm font-semibold text-white transition-all hover:bg-violet-700 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:ring-offset-2 active:scale-95"
          >
            <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
            </svg>
            Share QR
          </button>
        </div>
      </section>

      {footerSlot}

            <div className="pb-2 pt-2 text-center">
              <button
                type="button"
                onClick={handleHideFullProfile}
                aria-expanded={isExpanded}
                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 active:scale-[0.99]"
              >
                Hide Full Profile
                <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default BusinessProfileDisplay
