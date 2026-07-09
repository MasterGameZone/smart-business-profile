export interface BusinessReviewRow {
  id: string
  business_profile_id: string
  user_id: string
  rating: number
  review_text: string | null
  created_at: string
  updated_at: string
}

export interface BusinessReviewImageRow {
  id: string
  review_id: string
  business_profile_id: string
  user_id: string
  image_path: string
  sort_order: number
  created_at: string
}

export interface BusinessReviewImageInsert {
  review_id: string
  business_profile_id: string
  user_id: string
  image_path: string
  sort_order: number
}

export interface BusinessReviewWithImages extends BusinessReviewRow {
  images: BusinessReviewImageRow[]
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
