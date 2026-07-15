import { supabase } from './supabase.ts'
import type { BusinessProfileReportReason, BusinessProfileReportStatus } from '../types/businessProfileReport.ts'
import type {
  BusinessReviewImageRow,
  BusinessReviewReplyRow,
  BusinessReviewRow,
} from '../types/review.ts'
import type {
  CustomerReportActivityItem,
  CustomerReviewActivityItem,
} from '../types/customerActivity.ts'

interface ActivityBusinessProfileJoin {
  id: string
  business_name: string
  slug: string | null
}

interface CustomerReviewActivityRow extends BusinessReviewRow {
  business_review_images?: BusinessReviewImageRow[] | BusinessReviewImageRow | null
  business_review_replies?: BusinessReviewReplyRow[] | BusinessReviewReplyRow | null
  business_profile?: ActivityBusinessProfileJoin | ActivityBusinessProfileJoin[] | null
}

interface CustomerReportActivityRow {
  id: string
  business_profile_id: string
  reporter_user_id: string
  reason: BusinessProfileReportReason
  details: string | null
  status: BusinessProfileReportStatus
  created_at: string
  updated_at: string
  business_profile?: ActivityBusinessProfileJoin | ActivityBusinessProfileJoin[] | null
}

function normalizeJoinedBusinessName(
  businessProfile: ActivityBusinessProfileJoin | ActivityBusinessProfileJoin[] | null | undefined
): string {
  const profile = Array.isArray(businessProfile) ? businessProfile[0] : businessProfile
  return profile?.business_name ?? 'Business profile'
}

function normalizeReviewImages(
  images: BusinessReviewImageRow[] | BusinessReviewImageRow | null | undefined
): BusinessReviewImageRow[] {
  const normalizedImages = Array.isArray(images) ? images : images ? [images] : []
  return [...normalizedImages].sort(
    (a, b) => a.sort_order - b.sort_order || a.created_at.localeCompare(b.created_at)
  )
}

function normalizeReviewReply(
  replies: BusinessReviewReplyRow[] | BusinessReviewReplyRow | null | undefined
): BusinessReviewReplyRow | null {
  const normalizedReplies = Array.isArray(replies) ? replies : replies ? [replies] : []
  return normalizedReplies[0] ?? null
}

function normalizeCustomerReview(row: CustomerReviewActivityRow): CustomerReviewActivityItem {
  return {
    id: row.id,
    businessProfileId: row.business_profile_id,
    userId: row.user_id,
    businessName: normalizeJoinedBusinessName(row.business_profile),
    rating: row.rating,
    reviewText: row.review_text,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    images: normalizeReviewImages(row.business_review_images),
    ownerReply: normalizeReviewReply(row.business_review_replies),
  }
}

function normalizeCustomerReport(row: CustomerReportActivityRow): CustomerReportActivityItem {
  return {
    id: row.id,
    businessProfileId: row.business_profile_id,
    reporterUserId: row.reporter_user_id,
    businessName: normalizeJoinedBusinessName(row.business_profile),
    reason: row.reason,
    details: row.details,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export async function getCustomerReviewActivity(
  userId: string
): Promise<CustomerReviewActivityItem[]> {
  const { data, error } = await supabase
    .from('business_reviews')
    .select(
      `
      *,
      business_review_images(*),
      business_review_replies(*),
      business_profile:business_profiles(id, business_name, slug)
    `
    )
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (error) {
    throw error
  }

  return ((data ?? []) as CustomerReviewActivityRow[]).map(normalizeCustomerReview)
}

export async function getCustomerReportActivity(
  userId: string
): Promise<CustomerReportActivityItem[]> {
  const { data, error } = await supabase
    .from('business_profile_reports')
    .select(
      `
      *,
      business_profile:business_profiles(id, business_name, slug)
    `
    )
    .eq('reporter_user_id', userId)
    .order('created_at', { ascending: false })

  if (error) {
    throw error
  }

  return ((data ?? []) as CustomerReportActivityRow[]).map(normalizeCustomerReport)
}
