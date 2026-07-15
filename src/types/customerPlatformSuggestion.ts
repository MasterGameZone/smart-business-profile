export type CustomerFeatureKey =
  | 'appointment_booking'
  | 'offers_vouchers'
  | 'verified_business_badge'
  | 'advanced_directory_search'
  | 'business_enquiry_forms'

export interface CustomerFeatureOption {
  key: CustomerFeatureKey
  title: string
  description: string
}

export interface CustomerFeatureVoteRow {
  id: string
  customer_id: string
  feature_key: CustomerFeatureKey
  feature_title: string
  created_at: string
  updated_at: string
}

export type CustomerPlatformSuggestionType =
  | 'Feature Suggestion'
  | 'Category Suggestion'
  | 'Platform Improvement'

export type CustomerPlatformSuggestionStatus =
  | 'Submitted'
  | 'Under Review'
  | 'Planned'
  | 'Added'
  | 'Declined'

export interface CustomerPlatformSuggestionRow {
  id: string
  customer_id: string
  suggestion_type: CustomerPlatformSuggestionType
  title: string
  message: string
  status: CustomerPlatformSuggestionStatus
  created_at: string
  updated_at: string
}

export interface CreateCustomerPlatformSuggestionPayload {
  customerId: string
  suggestionType: CustomerPlatformSuggestionType
  title: string
  message: string
}
