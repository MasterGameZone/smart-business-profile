export interface BusinessReviewRow {
  id: string
  business_profile_id: string
  user_id: string
  rating: number
  review_text: string | null
  created_at: string
  updated_at: string
}

export interface BusinessReviewInsert {
  business_profile_id: string
  user_id: string
  rating: number
  review_text?: string | null
}

export interface BusinessReviewUpdate {
  rating: number
  review_text?: string | null
}
