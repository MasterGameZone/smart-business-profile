import { useEffect, useMemo, useState, type FormEvent } from 'react'
import type { BusinessReviewRow } from '../types/review.ts'
import {
  createBusinessReview,
  deleteBusinessReview,
  getBusinessReviews,
  updateBusinessReview,
} from '../lib/reviewService.ts'

interface ReviewSectionProps {
  businessProfileId: string
  userId: string | null
  onLogin: () => void
}

type ReviewAction = 'create' | 'update' | 'delete'

function formatReviewDate(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''

  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date)
}

function getReviewSummary(reviews: BusinessReviewRow[]): { average: number; count: number } {
  if (reviews.length === 0) {
    return { average: 0, count: 0 }
  }

  const total = reviews.reduce((sum, review) => sum + review.rating, 0)
  return {
    average: Math.round((total / reviews.length) * 10) / 10,
    count: reviews.length,
  }
}

function StarIcon({ filled }: { filled: boolean }) {
  return (
    <svg
      className={`h-5 w-5 ${filled ? 'text-amber-400' : 'text-gray-300'}`}
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M9.05 2.93c.3-.92 1.6-.92 1.9 0l1.18 3.63a1 1 0 0 0 .95.69h3.82c.97 0 1.37 1.24.59 1.81l-3.09 2.24a1 1 0 0 0-.36 1.12l1.18 3.63c.3.92-.76 1.69-1.54 1.12l-3.09-2.24a1 1 0 0 0-1.18 0l-3.09 2.24c-.78.57-1.84-.2-1.54-1.12l1.18-3.63a1 1 0 0 0-.36-1.12L2.51 9.06c-.78-.57-.38-1.81.59-1.81h3.82a1 1 0 0 0 .95-.69l1.18-3.63z" />
    </svg>
  )
}

function StarDisplay({ rating, label }: { rating: number; label: string }) {
  const roundedRating = Math.round(rating)

  return (
    <div className="flex items-center gap-0.5" aria-label={label}>
      {[1, 2, 3, 4, 5].map((value) => (
        <StarIcon key={value} filled={value <= roundedRating} />
      ))}
    </div>
  )
}

function RatingSelector({
  value,
  onChange,
}: {
  value: number
  onChange: (rating: number) => void
}) {
  return (
    <div className="flex items-center gap-1" role="radiogroup" aria-label="Select rating">
      {[1, 2, 3, 4, 5].map((rating) => (
        <button
          key={rating}
          type="button"
          role="radio"
          aria-checked={value === rating}
          aria-label={`${rating} star${rating === 1 ? '' : 's'}`}
          onClick={() => onChange(rating)}
          className="rounded-lg p-1 transition hover:bg-amber-50 focus:outline-none focus:ring-2 focus:ring-amber-300"
        >
          <StarIcon filled={rating <= value} />
        </button>
      ))}
    </div>
  )
}

function ReviewSection({ businessProfileId, userId, onLogin }: ReviewSectionProps) {
  const [reviews, setReviews] = useState<BusinessReviewRow[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [activeAction, setActiveAction] = useState<ReviewAction | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [rating, setRating] = useState(0)
  const [reviewText, setReviewText] = useState('')

  const ownReview = useMemo(
    () => reviews.find((review) => userId && review.user_id === userId) ?? null,
    [reviews, userId]
  )
  const summary = useMemo(() => getReviewSummary(reviews), [reviews])

  useEffect(() => {
    let cancelled = false

    async function loadReviews() {
      setIsLoading(true)
      setLoadError(false)

      try {
        const loadedReviews = await getBusinessReviews(businessProfileId)
        if (cancelled) return

        setReviews(loadedReviews)
      } catch (error) {
        if (cancelled) return
        console.error('Failed to load business reviews:', error)
        setLoadError(true)
      } finally {
        if (!cancelled) {
          setIsLoading(false)
        }
      }
    }

    loadReviews()

    return () => {
      cancelled = true
    }
  }, [businessProfileId])

  const resetForm = () => {
    setRating(0)
    setReviewText('')
    setActionError(null)
  }

  const startEditing = (review: BusinessReviewRow) => {
    setRating(review.rating)
    setReviewText(review.review_text ?? '')
    setIsEditing(true)
    setActionError(null)
  }

  const cancelEditing = () => {
    setIsEditing(false)
    resetForm()
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!userId) return

    if (rating < 1 || rating > 5) {
      setActionError('Please select a rating before submitting.')
      return
    }

    setActionError(null)
    setActiveAction(ownReview && isEditing ? 'update' : 'create')

    try {
      if (ownReview && isEditing) {
        const updatedReview = await updateBusinessReview(ownReview.id, userId, {
          rating,
          review_text: reviewText,
        })

        setReviews((currentReviews) =>
          currentReviews.map((review) =>
            review.id === updatedReview.id ? updatedReview : review
          )
        )
        setIsEditing(false)
        resetForm()
        return
      }

      const createdReview = await createBusinessReview(
        userId,
        businessProfileId,
        rating,
        reviewText
      )

      setReviews((currentReviews) => {
        const withoutDuplicate = currentReviews.filter(
          (review) => review.id !== createdReview.id && review.user_id !== userId
        )
        return [createdReview, ...withoutDuplicate]
      })
      resetForm()
    } catch (error) {
      console.error('Failed to save business review:', error)
      setActionError(
        ownReview && isEditing
          ? 'Unable to update review right now.'
          : 'Unable to submit review right now.'
      )
    } finally {
      setActiveAction(null)
    }
  }

  const handleDelete = async (review: BusinessReviewRow) => {
    if (!userId) return

    const confirmed = window.confirm('Delete your review?')
    if (!confirmed) return

    setActionError(null)
    setActiveAction('delete')

    try {
      await deleteBusinessReview(review.id, userId)
      setReviews((currentReviews) =>
        currentReviews.filter((currentReview) => currentReview.id !== review.id)
      )
      setIsEditing(false)
      resetForm()
    } catch (error) {
      console.error('Failed to delete business review:', error)
      setActionError('Unable to delete review right now.')
    } finally {
      setActiveAction(null)
    }
  }

  const showReviewForm = Boolean(userId) && (!ownReview || isEditing)
  const submitLabel = ownReview && isEditing ? 'Save Changes' : 'Submit Review'

  return (
    <section aria-label="Ratings and Reviews" className="rounded-2xl border border-gray-100 bg-white px-6 py-6 shadow-sm sm:px-8">
      <div className="mb-5">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-400">
          Ratings & Reviews
        </h2>

        <div className="mt-4 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-4">
          {summary.count > 0 ? (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-2xl font-bold text-gray-900">{summary.average.toFixed(1)}</p>
                <p className="mt-1 text-sm text-gray-500">
                  Based on {summary.count} review{summary.count === 1 ? '' : 's'}
                </p>
              </div>
              <StarDisplay
                rating={summary.average}
                label={`${summary.average.toFixed(1)} out of 5 average rating`}
              />
            </div>
          ) : (
            <div>
              <p className="text-sm font-semibold text-gray-900">No reviews yet.</p>
              <p className="mt-1 text-sm text-gray-500">Be the first to rate this business.</p>
            </div>
          )}
        </div>
      </div>

      {loadError && (
        <p role="alert" className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
          Unable to load reviews right now.
        </p>
      )}

      {isLoading ? (
        <p className="text-sm text-gray-500">Loading reviews...</p>
      ) : (
        <>
          {!userId && (
            <div className="mb-5 rounded-2xl border border-blue-100 bg-blue-50 px-4 py-4">
              <p className="text-sm font-medium text-blue-950">Log in to rate this business.</p>
              <p className="mt-1 text-sm text-blue-800">
                You can read reviews without an account.
              </p>
              <button
                type="button"
                onClick={onLogin}
                className="mt-3 inline-flex items-center justify-center rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              >
                Log in to Review
              </button>
            </div>
          )}

          {showReviewForm && (
            <form onSubmit={handleSubmit} className="mb-6 rounded-2xl border border-gray-100 bg-white px-4 py-4">
              <div className="flex items-center justify-between gap-4">
                <label className="text-sm font-semibold text-gray-900">Your rating</label>
                {ownReview && isEditing && (
                  <button
                    type="button"
                    onClick={cancelEditing}
                    className="text-sm font-medium text-gray-500 hover:text-gray-700 focus:outline-none focus:underline"
                  >
                    Cancel
                  </button>
                )}
              </div>

              <div className="mt-2">
                <RatingSelector value={rating} onChange={setRating} />
              </div>

              <label htmlFor="reviewText" className="mt-4 block text-sm font-semibold text-gray-900">
                Review text <span className="font-normal text-gray-400">Optional</span>
              </label>
              <textarea
                id="reviewText"
                value={reviewText}
                onChange={(event) => setReviewText(event.target.value)}
                rows={3}
                placeholder="Share a short note about your experience."
                className="mt-2 w-full resize-y rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
              />

              {actionError && (
                <p role="alert" className="mt-3 text-sm text-red-600">
                  {actionError}
                </p>
              )}

              <button
                type="submit"
                disabled={activeAction === 'create' || activeAction === 'update'}
                className="mt-4 inline-flex w-full items-center justify-center rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-70 sm:w-auto"
              >
                {activeAction === 'create' || activeAction === 'update' ? 'Saving...' : submitLabel}
              </button>
            </form>
          )}

          {actionError && !showReviewForm && (
            <p role="alert" className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
              {actionError}
            </p>
          )}

          {reviews.length > 0 && (
            <ul className="space-y-4">
              {reviews.map((review) => {
                const isOwnReview = Boolean(userId && review.user_id === userId)
                const displayDate = formatReviewDate(review.updated_at || review.created_at)

                return (
                  <li key={review.id} className="border-t border-gray-100 pt-4 first:border-t-0 first:pt-0">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-sm font-semibold text-gray-900">
                          {isOwnReview ? 'Your review' : 'Customer'}
                        </p>
                        {displayDate && (
                          <p className="mt-0.5 text-xs text-gray-400">{displayDate}</p>
                        )}
                      </div>
                      <StarDisplay rating={review.rating} label={`${review.rating} out of 5 rating`} />
                    </div>

                    {review.review_text ? (
                      <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-gray-700">
                        {review.review_text}
                      </p>
                    ) : (
                      <p className="mt-3 text-sm text-gray-500">Rating only.</p>
                    )}

                    {isOwnReview && !isEditing && (
                      <div className="mt-3 flex flex-wrap gap-3">
                        <button
                          type="button"
                          onClick={() => startEditing(review)}
                          className="text-sm font-medium text-blue-600 hover:text-blue-700 focus:outline-none focus:underline"
                        >
                          Edit Review
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(review)}
                          disabled={activeAction === 'delete'}
                          className="text-sm font-medium text-red-600 hover:text-red-700 focus:outline-none focus:underline disabled:cursor-not-allowed disabled:opacity-70"
                        >
                          {activeAction === 'delete' ? 'Deleting...' : 'Delete Review'}
                        </button>
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </>
      )}
    </section>
  )
}

export default ReviewSection
