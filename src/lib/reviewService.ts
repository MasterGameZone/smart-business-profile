import type { PostgrestError } from '@supabase/supabase-js'
import { supabase } from './supabase.ts'
import type {
  BusinessReviewInsert,
  BusinessReviewRow,
  BusinessReviewUpdate,
} from '../types/review.ts'

function normalizeReviewText(value: string): string | null {
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function isDuplicateReviewError(error: PostgrestError | null): boolean {
  return error?.code === '23505'
}

export async function getBusinessReviews(
  businessProfileId: string
): Promise<BusinessReviewRow[]> {
  const { data, error } = await supabase
    .from('business_reviews')
    .select('*')
    .eq('business_profile_id', businessProfileId)
    .order('created_at', { ascending: false })

  if (error) {
    throw error
  }

  return (data ?? []) as BusinessReviewRow[]
}

export async function getUserBusinessReview(
  userId: string,
  businessProfileId: string
): Promise<BusinessReviewRow | null> {
  const { data, error } = await supabase
    .from('business_reviews')
    .select('*')
    .eq('user_id', userId)
    .eq('business_profile_id', businessProfileId)
    .maybeSingle()

  if (error) {
    throw error
  }

  return (data ?? null) as BusinessReviewRow | null
}

export async function createBusinessReview(
  userId: string,
  businessProfileId: string,
  rating: number,
  reviewText: string
): Promise<BusinessReviewRow> {
  const payload: BusinessReviewInsert = {
    user_id: userId,
    business_profile_id: businessProfileId,
    rating,
    review_text: normalizeReviewText(reviewText),
  }

  const { data, error } = await supabase
    .from('business_reviews')
    .insert(payload)
    .select('*')
    .single()

  if (error) {
    if (isDuplicateReviewError(error)) {
      const existingReview = await getUserBusinessReview(userId, businessProfileId)
      if (existingReview) return existingReview
    }

    throw error
  }

  return data as BusinessReviewRow
}

export async function updateBusinessReview(
  reviewId: string,
  userId: string,
  updates: BusinessReviewUpdate
): Promise<BusinessReviewRow> {
  const { data, error } = await supabase
    .from('business_reviews')
    .update({
      rating: updates.rating,
      review_text: normalizeReviewText(updates.review_text ?? ''),
    })
    .eq('id', reviewId)
    .eq('user_id', userId)
    .select('*')
    .single()

  if (error) {
    throw error
  }

  return data as BusinessReviewRow
}

export async function deleteBusinessReview(
  reviewId: string,
  userId: string
): Promise<void> {
  const { error } = await supabase
    .from('business_reviews')
    .delete()
    .eq('id', reviewId)
    .eq('user_id', userId)

  if (error) {
    throw error
  }
}
