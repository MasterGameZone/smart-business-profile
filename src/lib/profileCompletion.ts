import type { BusinessProfileRow, JsonObject } from '../types/businessProfile'

export type ProfileHealthLabel = 'Needs attention' | 'Almost ready' | 'Nearly complete' | 'Strong'

export interface BusinessProfileCompletionResult {
  completionPercent: number
  completionPercentLabel: string
  isComplete: boolean
  missingItems: string[]
  completedItems: number
  totalItems: number
  healthLabel: ProfileHealthLabel
  improvementTips: string[]
  trustBoosters: {
    documentsAdded: number
  }
}

interface ScoreItem {
  label: string
  weight: number
  score: number
  index: number
}

const IMPROVEMENT_TIPS = [
  'Keep working hours updated',
  'Add fresh gallery photos',
  'Share your QR code with customers',
]

function hasText(value: string | null | undefined): boolean {
  return typeof value === 'string' && value.trim().length > 0
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function countTextItems(value: unknown[] | null | undefined, limit: number): number {
  if (!Array.isArray(value)) return 0

  return value
    .filter((item) => typeof item === 'string' && item.trim().length > 0)
    .slice(0, limit)
    .length
}

function countValidSocialLinks(value: BusinessProfileRow['social_links']): number {
  if (!isRecord(value)) return 0

  return Object.values(value)
    .filter((entryValue) => typeof entryValue === 'string' && entryValue.trim().length > 0)
    .slice(0, 2)
    .length
}

function countValidProductItems(value: BusinessProfileRow['products_menu_packages']): number {
  if (!Array.isArray(value)) return 0

  return value
    .filter((item) => hasText(item?.name) && hasText(item?.price))
    .slice(0, 5)
    .length
}

function countValidFaqs(value: BusinessProfileRow['faqs']): number {
  if (!Array.isArray(value)) return 0

  return value
    .filter((item) => hasText(item?.question) && hasText(item?.answer))
    .slice(0, 5)
    .length
}

function hasMeaningfulWorkingHours(value: JsonObject | null | undefined): boolean {
  if (!isRecord(value)) return false

  return Object.values(value).some((dayValue) => {
    if (!isRecord(dayValue)) return false

    const isClosed = dayValue.closed === true
    const hasOpen = typeof dayValue.open === 'string' && dayValue.open.trim().length > 0
    const hasClose = typeof dayValue.close === 'string' && dayValue.close.trim().length > 0

    return isClosed || hasOpen || hasClose
  })
}

function countValidDocuments(profile: BusinessProfileRow | null | undefined): number {
  if (!profile) return 0

  const documentCount = Array.isArray(profile.business_profile_documents)
    ? profile.business_profile_documents.filter((document) => hasText(document.file_path)).length
    : 0
  const qualificationCount = Array.isArray(profile.qualifications)
    ? profile.qualifications.filter((qualification) => hasText(qualification.documentFilePath)).length
    : 0

  return documentCount + qualificationCount
}

function getHealthLabel(completionPercent: number): ProfileHealthLabel {
  if (completionPercent >= 100) return 'Strong'
  if (completionPercent >= 90) return 'Nearly complete'
  if (completionPercent >= 50) return 'Almost ready'
  return 'Needs attention'
}

function normalizePercentage(value: number): number {
  return Math.min(100, Math.round(Math.max(0, value) * 100) / 100)
}

export function formatCompletionPercent(value: number): string {
  return normalizePercentage(value).toLocaleString('en-US', {
    maximumFractionDigits: 2,
  })
}

function makeScoreItem(label: string, weight: number, score: number, index: number): ScoreItem {
  return {
    label,
    weight,
    score: Math.min(weight, Math.max(0, score)),
    index,
  }
}

export function getBusinessProfileCompletion(
  profile: BusinessProfileRow | null | undefined
): BusinessProfileCompletionResult {
  const scoreItems: ScoreItem[] = []
  let itemIndex = 0

  const addScore = (label: string, weight: number, score: number) => {
    scoreItems.push(makeScoreItem(label, weight, score, itemIndex))
    itemIndex += 1
  }

  addScore('Add business name', 5, hasText(profile?.business_name) ? 5 : 0)
  addScore('Add owner name', 4, hasText(profile?.owner_name) ? 4 : 0)
  addScore('Select business category', 5, hasText(profile?.business_category) ? 5 : 0)
  addScore('Add sub-category', 2, (countTextItems(profile?.business_subcategories, 8) / 8) * 2)
  addScore('Add business tagline', 2, hasText(profile?.tagline) ? 2 : 0)
  addScore(
    'Add established year or experience',
    2,
    typeof profile?.established_year === 'number' || typeof profile?.years_of_experience === 'number' ? 2 : 0
  )

  addScore('Add phone number', 5, hasText(profile?.phone_number) ? 5 : 0)
  addScore('Add WhatsApp number', 3, hasText(profile?.whatsapp_number) ? 3 : 0)
  addScore('Add email address', 4, hasText(profile?.email) ? 4 : 0)
  addScore('Add address', 5, hasText(profile?.address) ? 5 : 0)
  addScore('Add Google Maps link', 5, hasText(profile?.google_maps_url) ? 5 : 0)
  addScore('Add website', 1, hasText(profile?.website) ? 1 : 0)
  addScore('Add social links', 2, countValidSocialLinks(profile?.social_links ?? null))

  addScore('Add about business', 6, hasText(profile?.about_business) ? 6 : 0)
  addScore('Add services or products', 8, (countValidProductItems(profile?.products_menu_packages ?? null) / 5) * 8)
  addScore('Add business keywords', 3, countTextItems(profile?.keywords, 1) > 0 ? 3 : 0)
  addScore('Add working hours', 6, hasMeaningfulWorkingHours(profile?.working_hours) ? 6 : 0)
  addScore('Add FAQs', 2, (countValidFaqs(profile?.faqs ?? null) / 5) * 2)

  addScore('Add business logo', 7, hasText(profile?.logo_url) ? 7 : 0)
  addScore('Add cover banner', 7, hasText(profile?.cover_banner_url) ? 7 : 0)
  addScore('Add gallery images', 16, (countTextItems(profile?.gallery_images, 6) / 6) * 16)

  const rawScore = scoreItems.reduce((total, item) => total + item.score, 0)
  const completionPercent = normalizePercentage(rawScore)
  const isComplete = completionPercent === 100
  const missingItems = scoreItems
    .filter((item) => item.score < item.weight)
    .sort((first, second) => {
      const firstRemainingWeight = first.weight - first.score
      const secondRemainingWeight = second.weight - second.score
      return secondRemainingWeight - firstRemainingWeight || first.index - second.index
    })
    .map((item) => item.label)

  return {
    completionPercent,
    completionPercentLabel: formatCompletionPercent(completionPercent),
    isComplete,
    missingItems,
    completedItems: scoreItems.filter((item) => item.score >= item.weight).length,
    totalItems: scoreItems.length,
    healthLabel: getHealthLabel(completionPercent),
    improvementTips: isComplete ? IMPROVEMENT_TIPS.slice(0, 3) : [],
    trustBoosters: {
      documentsAdded: countValidDocuments(profile),
    },
  }
}
