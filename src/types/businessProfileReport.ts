export const businessProfileReportReasons = [
  'Fake business',
  'Wrong information',
  'Spam or scam',
  'Inappropriate content',
  'Duplicate profile',
  'Other',
] as const

export type BusinessProfileReportReason = (typeof businessProfileReportReasons)[number]

export type BusinessProfileReportStatus = 'pending' | 'reviewed' | 'resolved' | 'dismissed'

export interface BusinessProfileReportRow {
  id: string
  business_profile_id: string
  reporter_user_id: string
  reason: BusinessProfileReportReason
  details: string | null
  status: BusinessProfileReportStatus
  created_at: string
  updated_at: string
}

export interface BusinessProfileReportInsert {
  business_profile_id: string
  reporter_user_id: string
  reason: BusinessProfileReportReason
  details?: string | null
  status?: BusinessProfileReportStatus
}
