import type { PostgrestError } from '@supabase/supabase-js'
import { supabase } from './supabase.ts'
import { validateImageFile } from './storageService.ts'
import type {
  BusinessReviewImageInsert,
  BusinessReviewImageRow,
  BusinessReviewInsert,
  BusinessReviewRow,
  BusinessReviewUpdate,
  BusinessReviewWithImages,
} from '../types/review.ts'

const REVIEW_IMAGES_BUCKET = 'review-images'
const MAX_REVIEW_IMAGES = 3

function normalizeReviewText(value: string): string | null {
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function isDuplicateReviewError(error: PostgrestError | null): boolean {
  return error?.code === '23505'
}

function sortReviewImages(images: BusinessReviewImageRow[]): BusinessReviewImageRow[] {
  return [...images].sort((a, b) => a.sort_order - b.sort_order || a.created_at.localeCompare(b.created_at))
}

function normalizeReviewWithImages(
  review: BusinessReviewRow & {
    business_review_images?: BusinessReviewImageRow[] | BusinessReviewImageRow | null
  }
): BusinessReviewWithImages {
  const rawImages = Array.isArray(review.business_review_images)
    ? review.business_review_images
    : review.business_review_images
      ? [review.business_review_images]
      : []
  const { business_review_images: _images, ...reviewFields } = review

  return {
    ...reviewFields,
    images: sortReviewImages(rawImages),
  }
}

function assertValidReviewImageCount(count: number): void {
  if (count > MAX_REVIEW_IMAGES) {
    throw new Error('You can upload up to 3 images.')
  }
}

function assertValidReviewImage(file: File): void {
  const validation = validateImageFile(file)
  if (!validation.valid) {
    throw new Error(validation.error || 'Invalid image file.')
  }
}

function fileExtensionForMimeType(mimeType: string): string {
  switch (mimeType) {
    case 'image/jpeg':
      return 'jpg'
    case 'image/png':
      return 'png'
    case 'image/webp':
      return 'webp'
    default:
      return 'bin'
  }
}

function safePathSegment(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, '-')
}

function randomSuffix(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }

  return Math.random().toString(36).slice(2)
}

function buildReviewImagePath({
  file,
  userId,
  businessProfileId,
  reviewId,
}: {
  file: File
  userId: string
  businessProfileId: string
  reviewId: string
}): string {
  const extension = fileExtensionForMimeType(file.type)
  const fileName = `review-${Date.now()}-${randomSuffix()}.${extension}`

  return [
    safePathSegment(userId),
    safePathSegment(businessProfileId),
    safePathSegment(reviewId),
    fileName,
  ].join('/')
}

export function getReviewImagePublicUrl(imagePath: string): string {
  const { data } = supabase.storage.from(REVIEW_IMAGES_BUCKET).getPublicUrl(imagePath)
  return data.publicUrl
}

async function uploadReviewImage({
  file,
  userId,
  businessProfileId,
  reviewId,
}: {
  file: File
  userId: string
  businessProfileId: string
  reviewId: string
}): Promise<string> {
  assertValidReviewImage(file)

  const path = buildReviewImagePath({ file, userId, businessProfileId, reviewId })
  const { error } = await supabase.storage
    .from(REVIEW_IMAGES_BUCKET)
    .upload(path, file, {
      cacheControl: '3600',
      contentType: file.type,
      upsert: false,
    })

  if (error) {
    throw error
  }

  return path
}

async function removeReviewImagesFromStorage(images: BusinessReviewImageRow[]): Promise<void> {
  if (images.length === 0) return

  const { error } = await supabase.storage
    .from(REVIEW_IMAGES_BUCKET)
    .remove(images.map((image) => image.image_path))

  if (error) {
    throw error
  }
}

async function insertReviewImageRows({
  review,
  userId,
  files,
  startingSortOrder,
}: {
  review: BusinessReviewRow
  userId: string
  files: File[]
  startingSortOrder: number
}): Promise<BusinessReviewImageRow[]> {
  if (files.length === 0) return []

  const uploadedPaths: string[] = []

  try {
    for (const file of files) {
      uploadedPaths.push(
        await uploadReviewImage({
          file,
          userId,
          businessProfileId: review.business_profile_id,
          reviewId: review.id,
        })
      )
    }

    const payload: BusinessReviewImageInsert[] = uploadedPaths.map((imagePath, index) => ({
      review_id: review.id,
      business_profile_id: review.business_profile_id,
      user_id: userId,
      image_path: imagePath,
      sort_order: startingSortOrder + index,
    }))

    const { data, error } = await supabase
      .from('business_review_images')
      .insert(payload)
      .select('*')

    if (error) {
      throw error
    }

    return (data ?? []) as BusinessReviewImageRow[]
  } catch (error) {
    if (uploadedPaths.length > 0) {
      await supabase.storage.from(REVIEW_IMAGES_BUCKET).remove(uploadedPaths)
    }

    throw error
  }
}

export async function getBusinessReviews(
  businessProfileId: string
): Promise<BusinessReviewWithImages[]> {
  const { data, error } = await supabase
    .from('business_reviews')
    .select('*, business_review_images(*)')
    .eq('business_profile_id', businessProfileId)
    .order('created_at', { ascending: false })

  if (error) {
    throw error
  }

  return ((data ?? []) as Array<
    BusinessReviewRow & { business_review_images?: BusinessReviewImageRow[] | null }
  >).map(normalizeReviewWithImages)
}

export async function getUserBusinessReview(
  userId: string,
  businessProfileId: string
): Promise<BusinessReviewWithImages | null> {
  const { data, error } = await supabase
    .from('business_reviews')
    .select('*, business_review_images(*)')
    .eq('user_id', userId)
    .eq('business_profile_id', businessProfileId)
    .maybeSingle()

  if (error) {
    throw error
  }

  return data
    ? normalizeReviewWithImages(
        data as BusinessReviewRow & { business_review_images?: BusinessReviewImageRow[] | null }
      )
    : null
}

export async function createBusinessReview(
  userId: string,
  businessProfileId: string,
  rating: number,
  reviewText: string,
  imageFiles: File[] = []
): Promise<BusinessReviewWithImages> {
  assertValidReviewImageCount(imageFiles.length)
  imageFiles.forEach(assertValidReviewImage)

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

  const createdReview = data as BusinessReviewRow
  const images = await insertReviewImageRows({
    review: createdReview,
    userId,
    files: imageFiles,
    startingSortOrder: 0,
  })

  return {
    ...createdReview,
    images: sortReviewImages(images),
  }
}

export async function updateBusinessReview(
  reviewId: string,
  userId: string,
  updates: BusinessReviewUpdate,
  existingImages: BusinessReviewImageRow[] = [],
  removedImageIds: string[] = [],
  newImageFiles: File[] = []
): Promise<BusinessReviewWithImages> {
  const remainingImages = existingImages.filter((image) => !removedImageIds.includes(image.id))
  assertValidReviewImageCount(remainingImages.length + newImageFiles.length)
  newImageFiles.forEach(assertValidReviewImage)

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

  const updatedReview = data as BusinessReviewRow
  const removedImages = existingImages.filter((image) => removedImageIds.includes(image.id))

  if (removedImages.length > 0) {
    await removeReviewImagesFromStorage(removedImages)

    const { error: deleteImageRowsError } = await supabase
      .from('business_review_images')
      .delete()
      .in('id', removedImages.map((image) => image.id))
      .eq('user_id', userId)

    if (deleteImageRowsError) {
      throw deleteImageRowsError
    }
  }

  const uploadedImages = await insertReviewImageRows({
    review: updatedReview,
    userId,
    files: newImageFiles,
    startingSortOrder: remainingImages.length,
  })

  return {
    ...updatedReview,
    images: sortReviewImages([...remainingImages, ...uploadedImages]),
  }
}

export async function deleteBusinessReview(
  reviewId: string,
  userId: string,
  existingImages: BusinessReviewImageRow[] = []
): Promise<void> {
  await removeReviewImagesFromStorage(existingImages)

  const { error } = await supabase
    .from('business_reviews')
    .delete()
    .eq('id', reviewId)
    .eq('user_id', userId)

  if (error) {
    throw error
  }
}
