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

export interface BusinessReviewReplyRow {
  id: string
  review_id: string
  business_profile_id: string
  owner_user_id: string
  reply_text: string
  created_at: string
  updated_at: string
}

export interface BusinessReviewReplyInsert {
  review_id: string
  business_profile_id: string
  owner_user_id: string
  reply_text: string
}

export interface BusinessReviewReplyUpdate {
  reply_text: string
}

export interface BusinessReviewWithImages extends BusinessReviewRow {
  images: BusinessReviewImageRow[]
  ownerReply: BusinessReviewReplyRow | null
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
