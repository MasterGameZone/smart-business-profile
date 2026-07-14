import { cloneElement, isValidElement, useEffect, useRef, useState, type ReactElement, type ReactNode, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import QRCode from 'react-qr-code'
import { useAuth } from '../context/AuthContext.tsx'
import { getBusinessDocumentViewUrl } from '../lib/storageService.ts'
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
  previewActionSlot?: ReactNode
  footerSlot?: ReactNode
}

export const businessProfileOuterWrapperClassName =
  'rounded-[2rem] border border-[#c7d2df] bg-white p-1 shadow-[0_32px_80px_-38px_rgba(15,23,42,0.45)]'

const compactSecondaryButtonClass =
  'inline-flex h-7 min-w-0 items-center justify-center gap-1 whitespace-nowrap rounded-md border border-slate-300 bg-white px-2 text-[10px] font-medium leading-none text-black transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 active:scale-[0.99] sm:h-8 sm:gap-1.5 sm:rounded-lg sm:px-3 sm:text-xs'
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

interface WorkingHourRow {
  key: string
  day: string
  hours: string
  closed: boolean
  isToday: boolean
}

interface SocialLinkItem {
  label: string
  url: string
  platform: 'instagram' | 'facebook' | 'youtube' | 'linkedin' | 'x' | 'pinterest' | 'tiktok' | 'external'
}

type ContactInfoIconName = 'phone' | 'whatsapp' | 'email' | 'website'

interface ContactInfoItem {
  key: string
  label: string
  value: string
  href: string
  icon: ContactInfoIconName
  external?: boolean
}

interface QualificationDisplayItem {
  key: string
  title: string
  year: string
  documentPath: string
  hasAttachedDocument: boolean
  hasImagePreview: boolean
  immediatePreviewUrl: string | null
}

interface FaqDisplayItem {
  key: string
  question: string
  answer: string
}

function getTodayWorkingDayIndex(): number {
  const day = new Date().getDay()
  return day === 0 ? 6 : day - 1
}

function normalizeWorkingHours(value: JsonObject | null | undefined): WorkingHourRow[] {
  if (!isRecord(value)) return []

  const todayIndex = getTodayWorkingDayIndex()
  const hours: WorkingHourRow[] = []

  workingDayLabels.forEach(({ key, label }, index) => {
    const dayValue = value[key]
    if (!isRecord(dayValue)) return

    const closed = dayValue.closed === true
    const open = trimText(typeof dayValue.open === 'string' ? dayValue.open : '')
    const close = trimText(typeof dayValue.close === 'string' ? dayValue.close : '')

    if (closed) {
      hours.push({ key, day: label, hours: 'Closed', closed: true, isToday: index === todayIndex })
      return
    }

    if (open && close) {
      hours.push({
        key,
        day: label,
        hours: `${formatClockTime(open)} - ${formatClockTime(close)}`,
        closed: false,
        isToday: index === todayIndex,
      })
    }
  })

  return hours
}

function normalizeQualifications(
  value: BusinessProfileDisplayData['qualifications']
): QualificationDisplayItem[] {
  if (!Array.isArray(value)) return []

  return value.reduce<QualificationDisplayItem[]>((items, item, index) => {
    if (!item || typeof item !== 'object') return items

    const title = trimText(item.title)
    if (!title) return items

    const year = typeof item.year === 'number' && Number.isFinite(item.year) ? String(item.year) : ''
    const documentFilePath = trimText(item.documentFilePath)
    const documentMimeType = trimText(item.documentMimeType)
    const hasImagePreview = canRenderQualificationImagePreview(documentFilePath, documentMimeType)
    const immediatePreviewUrl = getImmediateQualificationPreviewUrl(documentFilePath)

    items.push({
      key: `qualification-${title}-${year || 'no-year'}-${index}`,
      title,
      year,
      documentPath: documentFilePath,
      hasAttachedDocument: Boolean(documentFilePath),
      hasImagePreview,
      immediatePreviewUrl,
    })

    return items
  }, [])
}

function canRenderQualificationImagePreview(documentPath: string, documentMimeType: string): boolean {
  const normalizedMimeType = documentMimeType.trim().toLowerCase()
  if (normalizedMimeType === 'image/jpeg' || normalizedMimeType === 'image/png' || normalizedMimeType === 'image/webp') {
    return true
  }

  const normalizedPath = documentPath.trim().toLowerCase()
  return (
    normalizedPath.endsWith('.jpg') ||
    normalizedPath.endsWith('.jpeg') ||
    normalizedPath.endsWith('.png') ||
    normalizedPath.endsWith('.webp')
  )
}

function getImmediateQualificationPreviewUrl(documentPath: string): string | null {
  const trimmedPath = documentPath.trim()
  if (!trimmedPath) return null

  try {
    const url = new URL(trimmedPath)
    return ['http:', 'https:', 'blob:', 'data:'].includes(url.protocol) ? trimmedPath : null
  } catch {
    return null
  }
}

function normalizeFaqs(value: BusinessProfileDisplayData['faqs']): FaqDisplayItem[] {
  if (!Array.isArray(value)) return []

  return value.reduce<FaqDisplayItem[]>((items, item, index) => {
    if (!item || typeof item !== 'object') return items

    const question = trimText(item.question)
    const answer = trimText(item.answer)
    if (!question || !answer) return items

    items.push({
      key: `faq-${question}-${index}`,
      question,
      answer,
    })

    return items
  }, [])
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

function toWhatsappUrl(value: string): string | null {
  const digits = value.replace(/\D/g, '')
  return digits ? `https://wa.me/${digits}` : null
}

function formatWebsiteDisplay(value: string): string {
  try {
    const url = new URL(value)
    const path = url.pathname === '/' ? '' : url.pathname.replace(/\/$/, '')
    return `${url.hostname}${path}`
  } catch {
    return value.replace(/^https?:\/\//, '')
  }
}

async function copyTextToClipboard(value: string): Promise<boolean> {
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(value)
      return true
    } catch {
      // Fall back to the legacy copy path below.
    }
  }

  if (typeof document === 'undefined') return false

  const textarea = document.createElement('textarea')
  textarea.value = value
  textarea.setAttribute('readonly', '')
  textarea.style.position = 'fixed'
  textarea.style.top = '-9999px'
  document.body.appendChild(textarea)
  textarea.select()

  try {
    return document.execCommand('copy')
  } catch {
    return false
  } finally {
    document.body.removeChild(textarea)
  }
}

function getSocialLinkDetails(url: string): Pick<SocialLinkItem, 'label' | 'platform'> {
  let hostname = ''

  try {
    hostname = new URL(url).hostname.toLowerCase()
  } catch {
    return {
      label: 'External Link',
      platform: 'external',
    }
  }

  const normalizedHost = hostname.startsWith('www.') ? hostname.slice(4) : hostname

  if (normalizedHost === 'instagram.com' || normalizedHost.endsWith('.instagram.com')) {
    return { label: 'Instagram', platform: 'instagram' }
  }

  if (
    normalizedHost === 'facebook.com' ||
    normalizedHost.endsWith('.facebook.com') ||
    normalizedHost === 'fb.com' ||
    normalizedHost.endsWith('.fb.com')
  ) {
    return { label: 'Facebook', platform: 'facebook' }
  }

  if (
    normalizedHost === 'youtube.com' ||
    normalizedHost.endsWith('.youtube.com') ||
    normalizedHost === 'youtu.be' ||
    normalizedHost.endsWith('.youtu.be')
  ) {
    return { label: 'YouTube', platform: 'youtube' }
  }

  if (normalizedHost === 'linkedin.com' || normalizedHost.endsWith('.linkedin.com')) {
    return { label: 'LinkedIn', platform: 'linkedin' }
  }

  if (
    normalizedHost === 'x.com' ||
    normalizedHost.endsWith('.x.com') ||
    normalizedHost === 'twitter.com' ||
    normalizedHost.endsWith('.twitter.com')
  ) {
    return { label: 'X', platform: 'x' }
  }

  if (
    normalizedHost === 'pinterest.com' ||
    normalizedHost.endsWith('.pinterest.com') ||
    normalizedHost === 'pin.it' ||
    normalizedHost.endsWith('.pin.it')
  ) {
    return { label: 'Pinterest', platform: 'pinterest' }
  }

  if (normalizedHost === 'tiktok.com' || normalizedHost.endsWith('.tiktok.com')) {
    return { label: 'TikTok', platform: 'tiktok' }
  }

  return {
    label: 'External Link',
    platform: 'external',
  }
}

function normalizeSocialLinks(value: SocialLinks | null | undefined): SocialLinkItem[] {
  if (!isRecord(value)) return []

  const links: SocialLinkItem[] = []

  for (const entryValue of Object.values(value)) {
    const url = typeof entryValue === 'string' ? toValidUrl(entryValue) : null

    if (url) {
      const { label, platform } = getSocialLinkDetails(url)
      links.push({ label, url, platform })
    }
  }

  return links.slice(0, 4)
}

function CategoryIcon() {
  return (
    <svg className="h-3.5 w-3.5 sm:h-4 sm:w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3.75 9.75L12 4.5l8.25 5.25v8.75a1 1 0 01-1 1H4.75a1 1 0 01-1-1V9.75z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8.25 19.5v-4.25a1 1 0 011-1h5.5a1 1 0 011 1v4.25M8.5 10.5h.01M12 10.5h.01M15.5 10.5h.01" />
    </svg>
  )
}

function ContactInfoIcon({ icon }: { icon: ContactInfoIconName }) {
  if (icon === 'whatsapp') {
    return (
      <svg className="h-[18px] w-[18px]" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
      </svg>
    )
  }

  if (icon === 'email') {
    return (
      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
      </svg>
    )
  }

  if (icon === 'website') {
    return (
      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
      </svg>
    )
  }

  return (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
    </svg>
  )
}

function getContactIconTone(icon: ContactInfoIconName): string {
  if (icon === 'whatsapp') return 'bg-emerald-50 text-emerald-600 ring-1 ring-emerald-100'
  if (icon === 'email') return 'bg-violet-50 text-violet-600 ring-1 ring-violet-100'
  if (icon === 'website') return 'bg-indigo-50 text-indigo-600 ring-1 ring-indigo-100'

  return 'bg-blue-50 text-blue-600 ring-1 ring-blue-100'
}

function getSocialIconTone(platform: SocialLinkItem['platform']): string {
  if (platform === 'instagram') return 'text-pink-600'
  if (platform === 'facebook') return 'text-blue-600'
  if (platform === 'youtube') return 'text-red-600'
  if (platform === 'linkedin') return 'text-sky-700'
  if (platform === 'x') return 'text-black'
  if (platform === 'pinterest') return 'text-rose-600'
  if (platform === 'tiktok') return 'text-cyan-600'

  return 'text-violet-600'
}

function SocialLinkIcon({ platform }: { platform: SocialLinkItem['platform'] }) {
  if (platform === 'facebook') {
    return (
      <svg className="h-[18px] w-[18px]" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M14 8h2.5V4.2A23.7 23.7 0 0012.86 4C9.25 4 6.78 6.2 6.78 10.25V14H3v4.25h3.78V24h4.65v-5.75h3.64L15.65 14h-4.22v-3.33C11.43 9.44 11.78 8 14 8z" />
      </svg>
    )
  }

  if (platform === 'instagram') {
    return (
      <svg className="h-[18px] w-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <rect width="16" height="16" x="4" y="4" rx="5" strokeWidth={2} />
        <path strokeLinecap="round" strokeWidth={2} d="M16.5 7.5h.01" />
        <circle cx="12" cy="12" r="3.5" strokeWidth={2} />
      </svg>
    )
  }

  if (platform === 'linkedin') {
    return (
      <svg className="h-[18px] w-[18px]" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M6.94 8.88H3.12V21h3.82V8.88zM5.03 3A2.2 2.2 0 002.8 5.2a2.2 2.2 0 002.18 2.21h.03A2.2 2.2 0 007.25 5.2 2.2 2.2 0 005.03 3zM21.2 14.05c0-3.7-1.98-5.42-4.62-5.42a3.98 3.98 0 00-3.62 2h.02V8.88H9.16c.05 1.14 0 12.12 0 12.12h3.82v-6.77c0-.36.03-.72.13-.98.28-.72.93-1.47 2.02-1.47 1.43 0 2 1.1 2 2.68V21h3.82l.25-6.95z" />
      </svg>
    )
  }

  if (platform === 'youtube') {
    return (
      <svg className="h-[18px] w-[18px]" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M21.58 7.2a2.75 2.75 0 00-1.94-1.95C17.93 4.8 12 4.8 12 4.8s-5.93 0-7.64.45A2.75 2.75 0 002.42 7.2C2 8.92 2 12.5 2 12.5s0 3.58.42 5.3a2.75 2.75 0 001.94 1.95c1.71.45 7.64.45 7.64.45s5.93 0 7.64-.45a2.75 2.75 0 001.94-1.95c.42-1.72.42-5.3.42-5.3s0-3.58-.42-5.3zM10 15.7V9.3l5.2 3.2L10 15.7z" />
      </svg>
    )
  }

  if (platform === 'x') {
    return (
      <svg className="h-[18px] w-[18px]" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M13.8 10.47L21.24 2h-1.76l-6.46 7.35L7.86 2H1.91l7.8 11.12L1.9 22h1.76l6.83-7.77L15.94 22h5.95l-8.09-11.53zm-2.42 2.75l-.79-1.1-6.29-8.8h2.72l5.08 7.1.79 1.1 6.6 9.24h-2.72l-5.39-7.54z" />
      </svg>
    )
  }

  if (platform === 'pinterest') {
    return (
      <svg className="h-[18px] w-[18px]" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12.07 2C6.62 2 4 5.9 4 10.15c0 2.47.94 4.67 2.95 5.49.33.14.62.01.72-.36.07-.25.22-.88.29-1.14.1-.37.06-.5-.21-.82-.58-.68-.96-1.56-.96-2.82 0-3.64 2.72-6.9 7.08-6.9 3.86 0 5.98 2.36 5.98 5.51 0 4.14-1.83 7.64-4.55 7.64-1.5 0-2.63-1.24-2.27-2.77.43-1.82 1.27-3.78 1.27-5.09 0-1.17-.63-2.15-1.93-2.15-1.53 0-2.76 1.59-2.76 3.71 0 1.35.46 2.27.46 2.27l-1.85 7.82c-.55 2.32-.08 5.16-.04 5.45.03.17.24.21.33.08.12-.16 1.69-2.1 2.22-4.04.15-.55.86-3.39.86-3.39.43.82 1.68 1.55 3.01 1.55 3.96 0 6.64-3.61 6.64-8.44C22 5.4 17.84 2 12.07 2z" />
      </svg>
    )
  }

  if (platform === 'tiktok') {
    return (
      <svg className="h-[18px] w-[18px]" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M15.86 2H12.8v12.35a2.5 2.5 0 11-2.16-2.47V8.77a5.6 5.6 0 104.87 5.58V7.92c1.2.86 2.67 1.36 4.2 1.38V6.24a4.82 4.82 0 01-2.55-.74A4.82 4.82 0 0115.86 2z" />
      </svg>
    )
  }

  return (
    <svg className="h-[18px] w-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.5 10.5L21 3m0 0h-5.5M21 3v5.5M10 4H7a3 3 0 00-3 3v10a3 3 0 003 3h10a3 3 0 003-3v-3" />
    </svg>
  )
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
  previewActionSlot,
  footerSlot,
}: BusinessProfileDisplayProps) {
  const { isLoading: isAuthLoading, session } = useAuth()
  const [isExpanded, setIsExpanded] = useState(false)
  const [isWorkingHoursExpanded, setIsWorkingHoursExpanded] = useState(false)
  const [isFaqsExpanded, setIsFaqsExpanded] = useState(false)
  const [isQrModalOpen, setIsQrModalOpen] = useState(false)
  const [openFaqKey, setOpenFaqKey] = useState<string | null>(null)
  const [addressCopied, setAddressCopied] = useState(false)
  const [logoFailed, setLogoFailed] = useState(false)
  const [failedOfferingImageKeys, setFailedOfferingImageKeys] = useState<Set<string>>(() => new Set())
  const [tallOfferingImageKeys, setTallOfferingImageKeys] = useState<Set<string>>(() => new Set())
  const [qualificationPreviewUrls, setQualificationPreviewUrls] = useState<Record<string, string>>({})
  const [failedQualificationPreviewKeys, setFailedQualificationPreviewKeys] = useState<Set<string>>(() => new Set())
  const compactCardRef = useRef<HTMLElement>(null)
  const copyAddressTimeoutRef = useRef<number | null>(null)
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
  const todayWorkingHours = workingHours.find((item) => item.isToday)?.hours ?? 'Hours unavailable'
  const googleMapsUrl = toValidUrl(profile.googleMapsUrl)
  const directionsUrl = toDirectionsUrl(googleMapsUrl, displayAddress)
  const socialLinks = normalizeSocialLinks(profile.socialLinks)
  const keywordItems = normalizeStringArray(profile.keywords)
  const galleryItems = normalizeStringArray(profile.galleryImages)
    .map(toDisplayImageUrl)
    .filter((url): url is string => Boolean(url))
  const qualificationItems = normalizeQualifications(profile.qualifications)
  const attachedQualificationItems = qualificationItems.filter((item) => item.hasAttachedDocument)
  const faqItems = normalizeFaqs(profile.faqs)
  const compactLocation = formatCompactLocation(displayAddress)
  const workingStatus = getCompactWorkingStatus(profile.workingHours)
  const experienceText = formatBusinessExperience(profile)
  const whatsappUrl = toWhatsappUrl(displayWhatsApp)
  const rawWhatsappUrl = toWhatsappUrl(displayRawWhatsApp)
  const websiteUrl = toValidUrl(displayWebsite)
  const contactItems: ContactInfoItem[] = [
    displayPhone
      ? {
          key: 'phone',
          label: 'Phone',
          value: displayPhone,
          href: `tel:${displayPhone}`,
          icon: 'phone',
        }
      : null,
    rawWhatsappUrl && displayRawWhatsApp
      ? {
          key: 'whatsapp',
          label: 'WhatsApp',
          value: displayRawWhatsApp,
          href: rawWhatsappUrl,
          icon: 'whatsapp',
          external: true,
        }
      : null,
    displayEmail
      ? {
          key: 'email',
          label: 'Email',
          value: displayEmail,
          href: `mailto:${displayEmail}`,
          icon: 'email',
        }
      : null,
    websiteUrl
      ? {
          key: 'website',
          label: 'Website',
          value: formatWebsiteDisplay(websiteUrl),
          href: websiteUrl,
          icon: 'website',
          external: true,
        }
      : null,
  ].filter((item): item is ContactInfoItem => Boolean(item))
  const hasRating = typeof profile.ratingAverage === 'number' && Number.isFinite(profile.ratingAverage) && Boolean(profile.ratingCount)
  const hasAboutSection = Boolean(profile.aboutBusiness || keywordItems.length > 0)
  const hasContactSection = contactItems.length > 0 || socialLinks.length > 0
  const hasLocationSection = Boolean(displayAddress || directionsUrl)
  const offeringSectionLabel = 'Services'
  const displayBusinessName = trimText(profile.businessName) || 'this business'
  const authViewerScopeKey = session?.user?.id ?? 'anonymous'
  const bottomActionBaseClass =
    'flex flex-1 min-w-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl bg-transparent px-1.5 py-2.5 text-[11px] font-semibold text-black shadow-none transition hover:bg-white/70 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-70 sm:gap-2 sm:px-2 sm:text-sm'
  const styledSaveButtonSlot = isValidElement<{ className?: string }>(saveButtonSlot)
    ? cloneElement(saveButtonSlot as ReactElement<{ className?: string }>, {
        className: `${saveButtonSlot.props.className ?? ''} ${bottomActionBaseClass} !border-0 !bg-transparent !px-2 !py-2.5 !text-black !shadow-none hover:!bg-white/70 [&_svg]:text-amber-600`,
      })
    : saveButtonSlot

  useEffect(() => {
    setLogoFailed(false)
  }, [profile.logoUrl])

  useEffect(() => {
    setFailedOfferingImageKeys(new Set())
    setTallOfferingImageKeys(new Set())
  }, [profile.products_menu_packages, profile.services])

  useEffect(() => {
    return () => {
      if (copyAddressTimeoutRef.current !== null) {
        window.clearTimeout(copyAddressTimeoutRef.current)
      }
    }
  }, [])

  useEffect(() => {
    if (!isFaqsExpanded) {
      setOpenFaqKey(null)
    }
  }, [isFaqsExpanded])

  useEffect(() => {
    if (!isQrModalOpen) return

    const originalOverflow = document.body.style.overflow
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsQrModalOpen(false)
      }
    }

    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      document.body.style.overflow = originalOverflow
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isQrModalOpen])

  useEffect(() => {
    setQualificationPreviewUrls({})
    setFailedQualificationPreviewKeys(new Set())
  }, [authViewerScopeKey, isAuthLoading, profile.qualifications])

  useEffect(() => {
    let isCurrent = true

    if (isAuthLoading) {
      return () => {
        isCurrent = false
      }
    }

    const imageQualifications = qualificationItems.filter(
      (item) => item.hasAttachedDocument && item.hasImagePreview && !item.immediatePreviewUrl
    )
    const immediatePreviewUrls = qualificationItems.reduce<Record<string, string>>((urls, item) => {
      if (item.hasImagePreview && item.immediatePreviewUrl) {
        urls[item.key] = item.immediatePreviewUrl
      }

      return urls
    }, {})

    if (imageQualifications.length === 0) {
      setQualificationPreviewUrls(immediatePreviewUrls)
      return () => {
        isCurrent = false
      }
    }

    void Promise.all(
      imageQualifications.map(async (item) => {
        const previewUrl = await getBusinessDocumentViewUrl(item.documentPath)
        return previewUrl ? [item.key, previewUrl] as const : null
      })
    ).then((entries) => {
      if (!isCurrent) return

      setQualificationPreviewUrls(
        entries.reduce<Record<string, string>>((urls, entry) => {
          if (entry) {
            urls[entry[0]] = entry[1]
          }

          return urls
        }, { ...immediatePreviewUrls })
      )
    })

    return () => {
      isCurrent = false
    }
  }, [authViewerScopeKey, isAuthLoading, profile.qualifications])

  const handleHideFullProfile = () => {
    setIsExpanded(false)
    requestAnimationFrame(() => {
      compactCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }

  const handleCopyAddress = async () => {
    if (!displayAddress) return

    const copied = await copyTextToClipboard(displayAddress)
    if (!copied) return

    setAddressCopied(true)
    if (copyAddressTimeoutRef.current !== null) {
      window.clearTimeout(copyAddressTimeoutRef.current)
    }

    copyAddressTimeoutRef.current = window.setTimeout(() => {
      setAddressCopied(false)
      copyAddressTimeoutRef.current = null
    }, 1800)
  }

  const handleToggleFaqSection = () => {
    setIsFaqsExpanded((current) => !current)
  }

  const handleOpenGalleryImage = (imageUrl: string) => {
    window.open(imageUrl, '_blank', 'noopener,noreferrer')
  }

  const handleViewAllGalleryImages = () => {
    const firstGalleryImage = galleryItems[0]
    if (!firstGalleryImage) return

    handleOpenGalleryImage(firstGalleryImage)
  }

  const handleOpenQualificationDocument = async (documentPath: string) => {
    if (isAuthLoading) return

    const viewUrl = await getBusinessDocumentViewUrl(documentPath)
    if (!viewUrl) return

    window.open(viewUrl, '_blank', 'noopener,noreferrer')
  }

  const handleViewAllQualifications = () => {
    attachedQualificationItems.forEach((item) => {
      void handleOpenQualificationDocument(item.documentPath)
    })
  }

  return (
    <div className="space-y-4">
      <article
        ref={compactCardRef}
        className="mx-auto w-full max-w-[45rem] overflow-hidden rounded-[1.5rem] border border-[#c7d2df] bg-white shadow-[0_24px_70px_-36px_rgba(15,23,42,0.55)] sm:rounded-[1.75rem]"
      >
        <div className="relative aspect-[16/6] w-full bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-700">
          {coverBannerUrl ? (
            <img
              src={coverBannerUrl}
              alt={`${profile.businessName} cover banner`}
              className="h-full w-full object-cover object-center"
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

        <div className="px-3.5 pb-3.5 sm:px-5 sm:pb-4">
          <div className="-mt-10 flex items-end justify-between gap-3 sm:-mt-11">
            <div
              className="relative flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full border-4 border-white bg-white shadow-xl ring-1 ring-slate-100 sm:h-24 sm:w-24"
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
                <span className="select-none text-xl font-bold text-blue-700 sm:text-2xl">{businessInitials}</span>
              )}
            </div>
          </div>

          <div className="mt-2.5 flex min-w-0 items-center gap-2">
            <h1 className="min-w-0 flex-1 truncate text-[1.35rem] font-bold leading-tight tracking-tight text-black sm:text-2xl">
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
            <div className="mt-2 flex min-w-0 items-center gap-1.5 text-xs font-medium text-blue-700 sm:text-[13px]">
              <span className="shrink-0" aria-hidden="true">
                <CategoryIcon />
              </span>
              <span className="truncate">{profile.businessCategory}</span>
            </div>
          )}

          {displayTagline && (
            <p className="mt-1.5 text-sm italic leading-relaxed text-black">{displayTagline}</p>
          )}

          {experienceText && (
            <p className="mt-2 flex items-center gap-1.5 text-sm font-medium text-black">
              <svg className="h-4 w-4 shrink-0 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 3l1.88 5.77h6.07l-4.91 3.57 1.88 5.77L12 14.54l-4.91 3.57 1.88-5.77-4.91-3.57h6.07L12 3z" />
              </svg>
              <span className="truncate">{experienceText}</span>
            </p>
          )}

          <div className="mt-3 flex min-w-0 items-center overflow-hidden whitespace-nowrap rounded-[1.15rem] border border-[#c7d2df] bg-[#f4f7fb] px-3 py-2 text-[11px] text-black sm:rounded-2xl sm:text-xs">
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
                    : 'text-black'
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
                <span className="min-w-0 truncate text-black">{workingStatus.detail}</span>
              </>
            )}
          </div>

          <div className="mt-3 grid grid-cols-4 gap-1.5 sm:mt-3.5 sm:gap-2" role="group" aria-label="Primary profile actions">
            <a
              href={displayPhone ? `tel:${displayPhone}` : undefined}
              aria-label="Call business"
              aria-disabled={!displayPhone}
              className={`flex min-h-[4.5rem] min-w-0 flex-col items-center justify-center gap-1 rounded-[0.9rem] border px-1 py-2.5 text-[11px] font-semibold transition focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 sm:min-h-[4.875rem] sm:gap-1.5 sm:rounded-[0.95rem] sm:py-3 sm:text-[13px] ${
                displayPhone
                  ? 'border-blue-100 bg-blue-50 text-blue-700 hover:bg-blue-100 active:scale-95'
                  : 'pointer-events-none cursor-not-allowed border-slate-100 bg-slate-50 text-slate-400'
              }`}
            >
              <svg className="h-5 w-5 shrink-0 sm:h-[1.35rem] sm:w-[1.35rem]" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
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
              className={`flex min-h-[4.5rem] min-w-0 flex-col items-center justify-center gap-1 rounded-[0.9rem] border px-1 py-2.5 text-[11px] font-semibold transition focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 sm:min-h-[4.875rem] sm:gap-1.5 sm:rounded-[0.95rem] sm:py-3 sm:text-[13px] ${
                whatsappUrl
                  ? 'border-emerald-100 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 active:scale-95'
                  : 'pointer-events-none cursor-not-allowed border-slate-100 bg-slate-50 text-slate-400'
              }`}
            >
              <svg className="h-5 w-5 shrink-0 sm:h-[1.35rem] sm:w-[1.35rem]" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
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
              className={`flex min-h-[4.5rem] min-w-0 flex-col items-center justify-center gap-1 rounded-[0.9rem] border px-1 py-2.5 text-[11px] font-semibold transition focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 sm:min-h-[4.875rem] sm:gap-1.5 sm:rounded-[0.95rem] sm:py-3 sm:text-[13px] ${
                directionsUrl
                  ? 'border-indigo-100 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 active:scale-95'
                  : 'pointer-events-none cursor-not-allowed border-slate-100 bg-slate-50 text-slate-400'
              }`}
            >
              <svg className="h-5 w-5 shrink-0 sm:h-[1.35rem] sm:w-[1.35rem]" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 21l7-18-18 7 8 4 3 7z" />
              </svg>
              <span className="max-w-full truncate">Directions</span>
            </a>

            <button
              type="button"
              onClick={onShare}
              aria-label="Share profile link"
              className="flex min-h-[4.5rem] min-w-0 flex-col items-center justify-center gap-1 rounded-[0.9rem] border border-amber-100 bg-amber-50 px-1 py-2.5 text-[11px] font-semibold text-amber-700 transition hover:bg-amber-100 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 active:scale-95 sm:min-h-[4.875rem] sm:gap-1.5 sm:rounded-[0.95rem] sm:py-3 sm:text-[13px]"
            >
              <svg className="h-5 w-5 shrink-0 sm:h-[1.35rem] sm:w-[1.35rem]" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
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
              className="mt-3.5 flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-700 focus:ring-offset-2 active:scale-[0.99]"
            >
              View Full Profile
              <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          )}

          {!isExpanded && previewActionSlot && <div className="mt-3.5">{previewActionSlot}</div>}
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
      {hasAboutSection && (
        <section aria-label="About Us" className="overflow-hidden rounded-3xl border border-[#c7d2df] bg-white px-5 py-6 shadow-sm sm:px-8">
          <div className="mb-4 flex items-center justify-between gap-4">
            <h2 className="text-lg font-bold tracking-tight text-black">About Us</h2>
          </div>

          {profile.aboutBusiness && (
            <p className="whitespace-pre-line text-sm leading-7 text-black">{profile.aboutBusiness}</p>
          )}

          {keywordItems.length > 0 && (
            <div className={profile.aboutBusiness ? 'mt-4' : ''}>
              <ul className="flex flex-wrap gap-2">
                {keywordItems.map((keyword) => (
                  <li
                    key={keyword}
                    className="inline-flex max-w-full items-center rounded-full border border-blue-100 bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700 sm:text-[13px]"
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
        <section aria-label={offeringSectionLabel} className="overflow-hidden rounded-3xl border border-[#c7d2df] bg-white py-6 shadow-sm">
          <div className="px-5 sm:px-8">
            <h2 className="text-lg font-bold tracking-tight text-black">{offeringSectionLabel}</h2>
          </div>

          <div className="mt-4 overflow-x-auto px-5 pb-1 sm:px-8">
            <ul className="flex gap-3">
              {offeringItems.map((item) => {
                const enquiryUrl = getOfferingEnquiryUrl(item.name, displayRawWhatsApp, displayPhone)
                const hasImage = Boolean(item.imageUrl) && !failedOfferingImageKeys.has(item.key)
                const shouldCropTallImage = tallOfferingImageKeys.has(item.key)

                return (
                  <li
                    key={item.key}
                    className="flex w-fit min-w-[15.5rem] max-w-[250px] shrink-0 overflow-hidden rounded-2xl border border-[#c7d2df] bg-white shadow-[0_12px_28px_-24px_rgba(15,23,42,0.5)] sm:min-w-[16.5rem] sm:max-w-[19rem] lg:min-w-[17.25rem] lg:max-w-[20rem]"
                  >
                    <div className="flex w-[5.75rem] shrink-0 self-stretch flex-col gap-2 p-3 sm:w-[6.25rem] sm:p-4 lg:w-[6.75rem]">
  <div className="overflow-hidden rounded-xl border border-[#c7d2df] bg-[#f4f7fb]">
    {hasImage ? (
      <img
        src={item.imageUrl ?? undefined}
        alt={`${item.name} image`}
        className={`block w-full object-cover object-center ${
          shouldCropTallImage
            ? 'h-[8.05rem] sm:h-[8.75rem] lg:h-[9.45rem]'
            : 'h-auto'
        }`}
        loading="lazy"
        onLoad={(event) => {
          const { naturalHeight, naturalWidth } = event.currentTarget
          if (!naturalHeight || !naturalWidth) return

          const isTooTall = naturalHeight / naturalWidth > 1.4
          setTallOfferingImageKeys((current) => {
            const next = new Set(current)
            if (isTooTall) {
              next.add(item.key)
            } else {
              next.delete(item.key)
            }
            return next
          })
        }}
        onError={(event) => {
          event.currentTarget.style.display = 'none'
          setFailedOfferingImageKeys((current) => {
            const next = new Set(current)
            next.add(item.key)
            return next
          })
        }}
      />
    ) : (
      <div className="flex h-[6.5rem] w-full items-center justify-center bg-[#f4f7fb] px-2 text-center text-[11px] font-medium text-black sm:h-[7rem] sm:text-xs lg:h-[7.5rem]">
        No Image
      </div>
    )}
  </div>

  {enquiryUrl && (
    <a
      href={enquiryUrl}
      target={enquiryUrl.startsWith('https://') ? '_blank' : undefined}
      rel={enquiryUrl.startsWith('https://') ? 'noopener noreferrer' : undefined}
      className="mt-auto inline-flex w-full items-center justify-center rounded-xl bg-blue-600 px-2.5 py-2 text-xs font-semibold text-white transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 sm:text-sm"
    >
      Enquire
    </a>
  )}
</div>

                    <div className="flex min-w-0 flex-[1_1_auto] flex-col justify-start py-3.5 pr-3.5 sm:py-4 sm:pr-4">
                      <div className="min-w-0">
                        <h3 className="line-clamp-2 text-sm font-bold leading-snug text-black sm:text-[15px]">{item.name}</h3>
                        {item.description && (
                          <p className="mt-1.5 line-clamp-3 text-xs leading-5 text-black sm:text-[13px]">{item.description}</p>
                        )}
                      </div>

                      <div className="mt-2.5">
                        {item.price ? (
                          <p className="min-w-0 truncate text-sm font-bold text-black sm:text-[15px]">{item.price}</p>
                        ) : (
                          <p className="min-w-0 truncate text-xs font-semibold uppercase tracking-wide text-black">
                            Service
                          </p>
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
        <section aria-label="Gallery" className="overflow-hidden rounded-3xl border border-[#c7d2df] bg-white py-6 shadow-sm">
          <div className="flex items-center justify-between gap-3 px-5 sm:px-8">
            <h2 className="text-lg font-bold tracking-tight text-black">Gallery</h2>
            <button
              type="button"
              onClick={handleViewAllGalleryImages}
              className="shrink-0 text-xs font-medium text-blue-700 transition hover:text-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 sm:text-[13px]"
            >
              View All
            </button>
          </div>

          <div className="mt-3 overflow-x-auto px-5 pb-0.5 sm:px-8">
            <div className="flex gap-2.5">
              {galleryItems.map((imageUrl, index) => (
                <button
                  key={imageUrl}
                  type="button"
                  onClick={() => handleOpenGalleryImage(imageUrl)}
                  aria-label={`Open ${profile.businessName} gallery image ${index + 1}`}
                  className="h-24 w-24 shrink-0 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 sm:h-[108px] sm:w-[108px]"
                >
                  <img
                    src={imageUrl}
                    alt={`${profile.businessName} gallery image ${index + 1}`}
                    className="h-24 w-24 shrink-0 rounded-2xl border border-slate-100 bg-[#f4f7fb] object-cover sm:h-[108px] sm:w-[108px]"
                    loading="lazy"
                    onError={(event) => {
                      event.currentTarget.style.display = 'none'
                    }}
                  />
                </button>
              ))}
            </div>
          </div>
        </section>
      )}

      {workingHours.length > 0 && (
        <section aria-label="Working Hours" className="overflow-hidden rounded-3xl border border-[#c7d2df] bg-white shadow-sm">
          <button
            type="button"
            onClick={() => setIsWorkingHoursExpanded((current) => !current)}
            aria-expanded={isWorkingHoursExpanded}
            className="flex w-full min-w-0 items-center gap-3 px-5 py-5 text-left focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-inset sm:px-8"
          >
            <span className="min-w-0 flex-1">
              <span className="block text-lg font-bold tracking-tight text-black">Working Hours</span>
              <span className="mt-2 flex min-w-0 items-center gap-2 text-sm">
                <span
                  className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ${
                    workingStatus.tone === 'open'
                      ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100'
                      : workingStatus.tone === 'closed'
                        ? 'bg-rose-50 text-rose-700 ring-1 ring-rose-100'
                        : 'bg-slate-100 text-black ring-1 ring-slate-200'
                  }`}
                >
                  <span
                    className={`h-2 w-2 rounded-full ${
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
                <span className="min-w-0 truncate text-black">
                  Today: {todayWorkingHours}
                </span>
              </span>
            </span>
            <svg
              className={`h-5 w-5 shrink-0 text-slate-400 transition-transform ${isWorkingHoursExpanded ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {isWorkingHoursExpanded && (
            <div className="border-t border-slate-100 px-5 pb-4 pt-2 sm:px-8">
              <ul className="space-y-1.5">
                {workingHours.map(({ key, day, hours, closed, isToday }) => (
                  <li
                    key={key}
                    className="flex min-w-0 items-center justify-between gap-4 py-1.5"
                  >
                    <span className={`min-w-0 truncate text-sm ${isToday ? 'font-semibold text-sky-500' : 'font-medium text-black'}`}>
                      {day}
                    </span>
                    <span className={`shrink-0 text-right text-sm font-medium ${closed ? 'text-black' : 'text-black'}`}>
                      {hours}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}

      {hasLocationSection && (
        <section aria-label="Location" className="overflow-hidden rounded-3xl border border-[#c7d2df] bg-white px-5 py-6 shadow-sm sm:px-8">
          <h2 className="text-lg font-bold tracking-tight text-black">Location</h2>
          <div className="mt-4 min-w-0">
            {displayAddress ? (
              <p
                className="min-w-0 truncate whitespace-nowrap text-[13px] font-medium leading-6 text-black sm:text-sm"
                title={displayAddress}
                aria-label={displayAddress}
              >
                {displayAddress}
              </p>
            ) : (
              <p className="min-w-0 truncate whitespace-nowrap text-[13px] leading-6 text-black sm:text-sm">Map link available</p>
            )}

            {(directionsUrl || displayAddress) && (
              <div
                className="mt-3 grid gap-2"
                style={{ gridTemplateColumns: `repeat(${directionsUrl && displayAddress ? 2 : 1}, minmax(0, 1fr))` }}
              >
                {directionsUrl && (
                  <a
                    href={directionsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={compactSecondaryButtonClass}
                  >
                    <svg className="h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 21l7-18-18 7 8 4 3 7z" />
                    </svg>
                    <span className="truncate">Get Directions</span>
                  </a>
                )}
                {displayAddress && (
                  <button
                    type="button"
                    onClick={handleCopyAddress}
                    className={compactSecondaryButtonClass}
                  >
                    <svg className="h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16h8M8 12h8m-7 8h6a2 2 0 002-2V8.83a2 2 0 00-.59-1.42l-3.82-3.82A2 2 0 0011.17 3H7a2 2 0 00-2 2v13a2 2 0 002 2h2z" />
                    </svg>
                    <span className="truncate">{addressCopied ? 'Copied' : 'Copy Address'}</span>
                  </button>
                )}
              </div>
            )}
          </div>
        </section>
      )}

      {hasContactSection && (
  <section
    aria-label="Contact Information"
    className="overflow-hidden rounded-3xl border border-[#c7d2df] bg-white px-5 py-3.5 shadow-sm sm:px-8 sm:py-4"
  >
    <h2 className="text-lg font-bold tracking-tight text-black">Contact Information</h2>

    {contactItems.length > 0 && (
      <ul className="mt-2.5 grid grid-cols-2 gap-x-3 gap-y-0.5">
        {contactItems.map((item) => (
          <li key={item.key} className="min-w-0">
            <a
              href={item.href}
              target={item.external ? '_blank' : undefined}
              rel={item.external ? 'noopener noreferrer' : undefined}
              aria-label={item.external ? `Open ${item.value}` : `${item.label} ${item.value}`}
              className="group flex min-w-0 items-center gap-2 rounded-xl bg-transparent px-2.5 py-0.5 text-left transition-colors duration-150 hover:bg-transparent focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2"
            >
              <span
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-transform duration-150 group-hover:scale-105 ${getContactIconTone(item.icon)}`}
                aria-hidden="true"
              >
                <ContactInfoIcon icon={item.icon} />
              </span>

              <span
                className="min-w-0 flex-1 truncate whitespace-nowrap text-[12.5px] font-medium text-black transition-colors duration-150 group-hover:text-slate-950 sm:text-[13.5px]"
                title={item.value}
              >
                {item.value}
              </span>
            </a>
          </li>
        ))}
      </ul>
    )}

    {socialLinks.length > 0 && (
      <div className={contactItems.length > 0 ? 'mt-2.5 border-t border-slate-100 pt-2' : 'mt-2.5'}>
        <div className="flex min-w-0 items-center gap-3">
          <h3 className="shrink-0 text-sm font-semibold text-black">Follow Us</h3>

          <div
            className="grid min-w-0 flex-1 gap-0.5 sm:gap-1"
            style={{ gridTemplateColumns: `repeat(${socialLinks.length}, minmax(0, 1fr))` }}
          >
            {socialLinks.map(({ label, url, platform }) => (
              <a
                key={`${label}-${url}`}
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`Open ${label}`}
                title={label}
                className="group flex h-7 min-w-0 items-center justify-center rounded-xl bg-transparent transition-colors duration-150 hover:bg-transparent focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2"
              >
                <span
                  className={`transition-transform duration-150 group-hover:scale-110 ${getSocialIconTone(platform)}`}
                  aria-hidden="true"
                >
                  <SocialLinkIcon platform={platform} />
                </span>
              </a>
            ))}
          </div>
        </div>
      </div>
    )}
  </section>
)}

      {qualificationItems.length > 0 && (
        <section aria-label="Certificates and Qualifications" className="overflow-hidden rounded-3xl border border-[#c7d2df] bg-white py-5 shadow-sm">
          <div className="flex items-center justify-between gap-3 px-5 sm:px-8">
            <h2 className="text-lg font-bold tracking-tight text-black">Certificates & Qualifications</h2>
            {attachedQualificationItems.length > 0 && (
              <button
                type="button"
                onClick={handleViewAllQualifications}
                className="shrink-0 text-xs font-medium text-blue-700 transition hover:text-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 sm:text-[13px]"
              >
                View All
              </button>
            )}
          </div>

          <div className="mt-3 overflow-x-auto scroll-smooth px-5 pb-0.5 sm:px-8">
            <ul className="flex snap-x snap-mandatory gap-2.5">
              {qualificationItems.map((item) => {
                const previewUrl = qualificationPreviewUrls[item.key]
                const shouldShowImagePreview = Boolean(previewUrl) && !failedQualificationPreviewKeys.has(item.key)

                return (
                  <li
                    key={item.key}
                    className="flex w-[clamp(170px,50vw,190px)] shrink-0 snap-start rounded-2xl border border-[#c7d2df] bg-[#f4f7fb] p-3"
                  >
                    <div className="flex min-w-0 items-start gap-2.5">
                      {shouldShowImagePreview ? (
                        <img
                          src={previewUrl}
                          alt={`${item.title} preview`}
                          className="h-24 w-24 shrink-0 rounded-2xl border border-slate-100 bg-white object-contain sm:h-[108px] sm:w-[108px]"
                          onError={() => {
                            setFailedQualificationPreviewKeys((current) => new Set(current).add(item.key))
                          }}
                        />
                      ) : (
                        <div className="flex h-24 w-24 shrink-0 flex-col items-center justify-center rounded-2xl border border-slate-100 bg-white text-blue-700 sm:h-[108px] sm:w-[108px]">
                          <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 3h7l5 5v13a1 1 0 01-1 1H7a1 1 0 01-1-1V4a1 1 0 011-1z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 3v5h5" />
                          </svg>
                        </div>
                      )}

                      <div className="flex min-w-0 flex-1 flex-col pt-0.5">
                        <div className="min-w-0">
                          <h3 className="line-clamp-2 text-sm font-bold leading-tight text-black">{item.title}</h3>
                          {item.year && (
                            <p className="mt-0.5 text-xs font-medium text-black">{item.year}</p>
                          )}
                        </div>

                        {item.hasAttachedDocument && (
                          <button
                            type="button"
                            onClick={() => void handleOpenQualificationDocument(item.documentPath)}
                            className={`mt-1.5 self-start ${compactSecondaryButtonClass}`}
                          >
                            View
                          </button>
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

      {footerSlot}

      {faqItems.length > 0 && (
        <section aria-label="Frequently Asked Questions" className="overflow-hidden rounded-3xl border border-[#c7d2df] bg-white shadow-sm">
          <button
            type="button"
            onClick={handleToggleFaqSection}
            aria-expanded={isFaqsExpanded}
            className="flex w-full min-w-0 items-center justify-between gap-3 px-5 py-5 text-left focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-inset sm:px-8"
          >
            <span className="min-w-0 truncate text-lg font-bold tracking-tight text-black">
              Frequently Asked Questions
            </span>
            <svg
              className={`h-5 w-5 shrink-0 text-slate-400 transition-transform ${isFaqsExpanded ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {isFaqsExpanded && (
            <div className="border-t border-slate-100 px-5 py-4 sm:px-8">
              <ul className="space-y-3">
                {faqItems.map((item, index) => {
                  const isAnswerOpen = openFaqKey === item.key
                  const answerId = `business-profile-faq-answer-${index}`

                  return (
                    <li key={item.key} className="rounded-2xl border border-[#c7d2df] bg-[#f4f7fb]">
                      <button
                        type="button"
                        onClick={() => setOpenFaqKey(isAnswerOpen ? null : item.key)}
                        aria-expanded={isAnswerOpen}
                        aria-controls={answerId}
                        className="flex w-full min-w-0 items-center justify-between gap-3 px-4 py-4 text-left focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-inset"
                      >
                        <span className="min-w-0 text-sm font-semibold leading-6 text-black">{item.question}</span>
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-black shadow-sm" aria-hidden="true">
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            {isAnswerOpen ? (
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14" />
                            ) : (
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v14m7-7H5" />
                            )}
                          </svg>
                        </span>
                      </button>

                      {isAnswerOpen && (
                        <div id={answerId} className="border-t border-slate-100 px-4 pb-4 pt-3">
                          <p className="whitespace-pre-line text-sm leading-7 text-black">{item.answer}</p>
                        </div>
                      )}
                    </li>
                  )
                })}
              </ul>
            </div>
          )}
        </section>
      )}

      {isQrModalOpen &&
        createPortal(
          <div
            className="fixed inset-0 z-[100] flex items-end justify-center bg-slate-950/45 p-0 sm:items-center sm:p-4"
            onClick={(event) => {
              if (event.target === event.currentTarget) {
                setIsQrModalOpen(false)
              }
            }}
          >
            <div className="relative w-full max-w-md">
              <button
                type="button"
                onClick={() => setIsQrModalOpen(false)}
                aria-label="Close QR Code"
                className="absolute right-4 top-4 z-10 inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/95 text-black shadow-sm transition hover:bg-white hover:text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>

              <div className="max-h-[88vh] overflow-y-auto rounded-t-[1.75rem] sm:rounded-[1.75rem]">
                <section
                  id="profile-qr-modal"
                  ref={qrSectionRef}
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby="profile-qr-modal-title"
                  aria-label="QR Code"
                  className="overflow-hidden border border-gray-100 bg-white px-6 py-8 shadow-sm sm:rounded-[1.75rem] sm:px-8"
                >
                  <div className="mb-6 text-center">
                    <h2 id="profile-qr-modal-title" className="text-sm font-bold tracking-tight text-black">
                      QR Code
                    </h2>
                    <p className="mt-1 text-xs text-black">Scan this QR Code to open this business profile.</p>
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
              </div>
            </div>
          </div>,
          document.body
        )}

            <section aria-label="Final contact actions" className="overflow-hidden rounded-3xl border border-[#c7d2df] bg-[#f8fafc] px-5 py-6 shadow-sm sm:px-8">
              <div className="min-w-0">
                <h2 className="text-lg font-bold tracking-tight text-black">
                  Stay connected with {displayBusinessName}
                </h2>
                <p className="mt-2 text-sm leading-6 text-black">Share this profile or save it for later.</p>
              </div>

              <div className="mt-4 border-t border-blue-100/90 pt-4">
                <div className="flex min-w-0 items-center" role="group" aria-label="Final profile actions">
                  <button
                    type="button"
                    onClick={onShare}
                    aria-label="Share profile link"
                    className={bottomActionBaseClass}
                  >
                    <svg className="h-4 w-4 shrink-0 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                    </svg>
                    <span className="min-w-0 whitespace-nowrap">Share</span>
                  </button>

                  <span className="mx-1.5 my-auto h-4 w-px shrink-0 bg-slate-200 sm:h-[15px] sm:mx-[5px]" aria-hidden="true" />

                  <button
                    type="button"
                    onClick={() => setIsQrModalOpen(true)}
                    aria-haspopup="dialog"
                    aria-expanded={isQrModalOpen}
                    aria-controls="profile-qr-modal"
                    className={bottomActionBaseClass}
                  >
                    <svg className="h-4 w-4 shrink-0 text-violet-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4h6v6H4V4zm10 0h6v6h-6V4zM4 14h6v6H4v-6zm11 1h2m-2 3h2m-5-3h1m2 5h5m-8-3v3m0-6v1m6 0v5" />
                    </svg>
                    <span className="min-w-0 whitespace-nowrap">QR Code</span>
                  </button>

                  {styledSaveButtonSlot && (
                    <>
                      <span className="mx-1.5 my-auto h-4 w-px shrink-0 bg-slate-200 sm:h-[15px] sm:mx-[5px]" aria-hidden="true" />
                      {isValidElement(styledSaveButtonSlot) ? (
                        styledSaveButtonSlot
                      ) : (
                        <div className="flex min-w-0 flex-1 items-center justify-center">{styledSaveButtonSlot}</div>
                      )}
                    </>
                  )}
                </div>
              </div>
            </section>

            <div className="pb-2 pt-2 text-center">
              <button
                type="button"
                onClick={handleHideFullProfile}
                aria-expanded={isExpanded}
                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-black shadow-sm transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 active:scale-[0.99]"
              >
                Hide Full Profile
                <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                </svg>
              </button>
            </div>

            {previewActionSlot && <div className="pb-2 pt-2">{previewActionSlot}</div>}
          </div>
        </div>
      </div>
    </div>
  )
}

export default BusinessProfileDisplay
