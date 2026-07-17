export type CustomerBusinessSupportStatus = 'Nominated' | 'Invitation Shared' | 'Profile Published'

export interface CustomerBusinessSupportRow {
  id: string
  customer_id: string
  business_name: string
  business_category: string
  business_location: string
  custom_message: string | null
  invitation_token: string
  status: CustomerBusinessSupportStatus
  published_profile_id: string | null
  invitation_shared_at: string | null
  invitation_opened_at: string | null
  invitation_open_count: number
  created_at: string
  updated_at: string
}

export interface CustomerBusinessSupportInsert {
  customer_id: string
  business_name: string
  business_category: string
  business_location: string
  custom_message?: string | null
  status?: CustomerBusinessSupportStatus
}

export interface CreateCustomerBusinessSupportPayload {
  customerId: string
  businessName: string
  businessCategory: string
  businessLocation: string
  customMessage: string | null
}

export interface CustomerSupportInvitePreview {
  customerName: string | null
}

export interface CustomerImpactProgress {
  percent: number
  text: string
}

export interface CustomerImpactSummary {
  badge: string
  level: string
  businessesSupported: number
  invitationsShared: number
  linksOpened: number
  profilesPublished: number
  progress: CustomerImpactProgress
  recentSupports: CustomerBusinessSupportRow[]
}
