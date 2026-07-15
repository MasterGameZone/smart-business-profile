import type { BusinessProfileReportReason, BusinessProfileReportStatus } from './businessProfileReport.ts'
import type { BusinessReviewImageRow, BusinessReviewReplyRow } from './review.ts'

export interface CustomerReviewActivityItem {
  id: string
  businessProfileId: string
  userId: string
  businessName: string
  rating: number
  reviewText: string | null
  createdAt: string
  updatedAt: string
  images: BusinessReviewImageRow[]
  ownerReply: BusinessReviewReplyRow | null
}

export interface CustomerReportActivityItem {
  id: string
  businessProfileId: string
  reporterUserId: string
  businessName: string
  reason: BusinessProfileReportReason
  details: string | null
  status: BusinessProfileReportStatus
  createdAt: string
  updatedAt: string
}
