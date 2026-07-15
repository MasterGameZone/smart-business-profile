import { useCallback, useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.tsx'
import { usePageMeta } from '../hooks/usePageMeta.ts'
import {
  getCustomerReportActivity,
  getCustomerReviewActivity,
} from '../lib/customerActivityService.ts'
import { deleteBusinessReview, updateBusinessReview } from '../lib/reviewService.ts'
import type { BusinessProfileReportStatus } from '../types/businessProfileReport.ts'
import type {
  CustomerReportActivityItem,
  CustomerReviewActivityItem,
} from '../types/customerActivity.ts'

type ActivityTab = 'reviews' | 'reports' | 'corrections'

type FeedbackMessage = {
  kind: 'success' | 'error'
  text: string
} | null

function getActiveTab(hash: string): ActivityTab {
  if (hash === '#reports') return 'reports'
  if (hash === '#corrections') return 'corrections'
  return 'reviews'
}

function formatDate(value: string): string {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return 'Date unavailable'
  }

  return new Intl.DateTimeFormat(undefined, {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(date)
}

function formatStatusLabel(status: BusinessProfileReportStatus): string {
  switch (status) {
    case 'pending':
      return 'Pending'
    case 'reviewed':
      return 'Reviewed'
    case 'resolved':
      return 'Resolved'
    case 'dismissed':
      return 'Dismissed'
  }
}

function statusPillClass(status: BusinessProfileReportStatus): string {
  switch (status) {
    case 'resolved':
      return 'bg-emerald-50 text-emerald-700'
    case 'reviewed':
      return 'bg-blue-50 text-blue-700'
    case 'dismissed':
      return 'bg-slate-100 text-slate-600'
    case 'pending':
      return 'bg-amber-50 text-amber-700'
  }
}

function RatingStars({ rating, labelId }: { rating: number; labelId: string }) {
  return (
    <div className="mt-2 flex items-center gap-1.5" aria-label={`${rating} out of 5 stars`}>
      {Array.from({ length: 5 }, (_, index) => (
        <svg
          key={`${labelId}-star-${index}`}
          className={`h-4 w-4 ${index < rating ? 'text-amber-500' : 'text-slate-300'}`}
          fill="currentColor"
          viewBox="0 0 20 20"
          aria-hidden="true"
        >
          <path d="M9.05 2.93c.3-.92 1.6-.92 1.9 0l1.1 3.38a1 1 0 0 0 .95.69h3.55c.97 0 1.37 1.24.59 1.81l-2.88 2.1a1 1 0 0 0-.36 1.12l1.1 3.39c.3.92-.76 1.68-1.54 1.12l-2.88-2.1a1 1 0 0 0-1.18 0l-2.88 2.1c-.78.56-1.84-.2-1.54-1.12l1.1-3.39a1 1 0 0 0-.36-1.12l-2.88-2.1C2.08 8.24 2.48 7 3.45 7H7a1 1 0 0 0 .95-.69z" />
        </svg>
      ))}
    </div>
  )
}

function CustomerMyActivityPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const { user, isLoading: isAuthLoading } = useAuth()
  const userId = user?.id ?? null

  const [reviewItems, setReviewItems] = useState<CustomerReviewActivityItem[]>([])
  const [reportItems, setReportItems] = useState<CustomerReportActivityItem[]>([])
  const [isReviewsLoading, setIsReviewsLoading] = useState(false)
  const [loadedReviewsCustomerId, setLoadedReviewsCustomerId] = useState<string | null>(null)
  const [loadedReportsCustomerId, setLoadedReportsCustomerId] = useState<string | null>(null)
  const [reviewsError, setReviewsError] = useState<string | null>(null)
  const [reportsError, setReportsError] = useState<string | null>(null)
  const [reviewFeedback, setReviewFeedback] = useState<FeedbackMessage>(null)
  const [editingReviewId, setEditingReviewId] = useState<string | null>(null)
  const [editRating, setEditRating] = useState(5)
  const [editReviewText, setEditReviewText] = useState('')
  const [savingReviewId, setSavingReviewId] = useState<string | null>(null)
  const [confirmDeleteReviewId, setConfirmDeleteReviewId] = useState<string | null>(null)
  const [deletingReviewId, setDeletingReviewId] = useState<string | null>(null)

  usePageMeta({
    title: 'My Activity | Smart Business Profile',
    description: 'View your customer reviews, reported profiles, and submitted corrections.',
  })

  const activeTab = getActiveTab(location.hash)

  const sectionClassName =
    'rounded-3xl border border-[#c7d2df] bg-white p-6 shadow-[0_24px_70px_-38px_rgba(2,12,27,0.98)] sm:p-8'
  const itemClassName = 'rounded-2xl border border-[#c7d2df] bg-[#f8fafc] px-4 py-4'
  const mutedLabelClassName = 'text-xs font-semibold uppercase tracking-[0.12em] text-slate-500'
  const valueClassName = 'mt-1 text-sm text-black'
  const actionClassName =
    'inline-flex min-h-[38px] items-center justify-center rounded-full border border-[#c7d2df] bg-white px-4 py-2 text-sm font-medium text-black focus:outline-none focus:ring-2 focus:ring-slate-300/80 focus:ring-offset-2 focus:ring-offset-slate-50 disabled:cursor-not-allowed disabled:opacity-70'
  const destructiveActionClassName =
    'inline-flex min-h-[38px] items-center justify-center rounded-full border border-red-200 bg-white px-4 py-2 text-sm font-medium text-red-700 focus:outline-none focus:ring-2 focus:ring-red-200 focus:ring-offset-2 focus:ring-offset-slate-50 disabled:cursor-not-allowed disabled:opacity-70'
  const tabClassName = (tab: ActivityTab) =>
    `inline-flex items-center justify-center rounded-full border px-4 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-slate-300/80 focus:ring-offset-2 focus:ring-offset-slate-50 ${
      activeTab === tab
        ? 'border-[#c7d2df] bg-[#f8fafc] text-black'
        : 'border-transparent bg-transparent text-slate-500'
    }`

  const refreshReviews = useCallback(async (nextUserId: string): Promise<void> => {
    setIsReviewsLoading(true)
    setReviewsError(null)

    try {
      const nextReviewItems = await getCustomerReviewActivity(nextUserId)
      setReviewItems(nextReviewItems)
      setLoadedReviewsCustomerId(nextUserId)
    } catch (error) {
      console.error('Failed to load customer reviews:', error)
      setLoadedReviewsCustomerId(nextUserId)
      setReviewsError('We could not load your reviews right now. Please try again.')
    } finally {
      setIsReviewsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (activeTab !== 'reviews' || isAuthLoading) return
    if (!userId) return

    let isCurrent = true

    void getCustomerReviewActivity(userId)
      .then((nextReviewItems) => {
        if (!isCurrent) return
        setReviewItems(nextReviewItems)
        setLoadedReviewsCustomerId(userId)
        setReviewsError(null)
      })
      .catch((error) => {
        if (!isCurrent) return
        console.error('Failed to load customer reviews:', error)
        setLoadedReviewsCustomerId(userId)
        setReviewsError('We could not load your reviews right now. Please try again.')
      })

    return () => {
      isCurrent = false
    }
  }, [activeTab, isAuthLoading, userId])

  useEffect(() => {
    if (activeTab !== 'reports' || isAuthLoading) return
    if (!userId) return

    let isCurrent = true

    void getCustomerReportActivity(userId)
      .then((nextReportItems) => {
        if (!isCurrent) return
        setReportItems(nextReportItems)
        setLoadedReportsCustomerId(userId)
        setReportsError(null)
      })
      .catch((error) => {
        if (!isCurrent) return
        console.error('Failed to load customer reports:', error)
        setLoadedReportsCustomerId(userId)
        setReportsError('We could not load your reported profiles right now. Please try again.')
      })

    return () => {
      isCurrent = false
    }
  }, [activeTab, isAuthLoading, userId])

  const startEditingReview = (review: CustomerReviewActivityItem) => {
    setReviewFeedback(null)
    setConfirmDeleteReviewId(null)
    setEditingReviewId(review.id)
    setEditRating(review.rating)
    setEditReviewText(review.reviewText ?? '')
  }

  const cancelEditingReview = () => {
    setEditingReviewId(null)
    setEditRating(5)
    setEditReviewText('')
  }

  const saveReview = async (review: CustomerReviewActivityItem): Promise<void> => {
    if (!userId) return

    setSavingReviewId(review.id)
    setReviewFeedback(null)

    try {
      await updateBusinessReview(
        review.id,
        userId,
        {
          rating: editRating,
          review_text: editReviewText,
        },
        review.images,
        [],
        []
      )
      await refreshReviews(userId)
      cancelEditingReview()
      setReviewFeedback({ kind: 'success', text: 'Review updated.' })
    } catch (error) {
      console.error('Failed to update customer review:', error)
      setReviewFeedback({ kind: 'error', text: 'We could not update this review. Please try again.' })
    } finally {
      setSavingReviewId(null)
    }
  }

  const deleteReview = async (review: CustomerReviewActivityItem): Promise<void> => {
    if (!userId) return

    setDeletingReviewId(review.id)
    setReviewFeedback(null)

    try {
      await deleteBusinessReview(review.id, userId, review.images)
      setReviewItems((currentItems) => currentItems.filter((item) => item.id !== review.id))
      if (editingReviewId === review.id) {
        cancelEditingReview()
      }
      setConfirmDeleteReviewId(null)
      setReviewFeedback({ kind: 'success', text: 'Review deleted.' })
    } catch (error) {
      console.error('Failed to delete customer review:', error)
      setReviewFeedback({ kind: 'error', text: 'We could not delete this review. Please try again.' })
    } finally {
      setDeletingReviewId(null)
    }
  }

  const reviewDisplayError =
    !isAuthLoading && !userId ? 'Please sign in to view your reviews.' : reviewsError
  const reportDisplayError =
    !isAuthLoading && !userId ? 'Please sign in to view your reported profiles.' : reportsError
  const showReviewsLoading =
    isAuthLoading || isReviewsLoading || Boolean(userId && loadedReviewsCustomerId !== userId)
  const showReportsLoading =
    isAuthLoading || Boolean(userId && loadedReportsCustomerId !== userId)

  return (
    <div className="min-h-screen bg-[#eef4fa] text-black">
      <main className="mx-auto max-w-4xl px-4 py-10 sm:py-12">
        <section className="mb-8">
          <h1 className="text-2xl font-bold tracking-tight text-black sm:text-3xl">My Activity</h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-black sm:text-base">
            Review your customer-side activity history across ratings, reports, and submitted corrections.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => navigate('/customer/my-activity#reviews')}
              className={tabClassName('reviews')}
            >
              Ratings & Reviews
            </button>
            <button
              type="button"
              onClick={() => navigate('/customer/my-activity#reports')}
              className={tabClassName('reports')}
            >
              Reported Profiles
            </button>
            <button
              type="button"
              onClick={() => navigate('/customer/my-activity#corrections')}
              className={tabClassName('corrections')}
            >
              Submitted Corrections
            </button>
          </div>
        </section>

        <div className="space-y-6">
          {activeTab === 'reviews' && (
            <section className={sectionClassName}>
              <div>
                <h2 className="text-lg font-semibold tracking-tight text-black sm:text-xl">Ratings & Reviews</h2>
                <p className="mt-1 text-sm text-black">Reviews you have submitted for business profiles.</p>
              </div>

              {reviewFeedback && (
                <div
                  className={`mt-5 rounded-2xl border px-4 py-3 text-sm ${
                    reviewFeedback.kind === 'success'
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                      : 'border-red-200 bg-red-50 text-red-700'
                  }`}
                >
                  {reviewFeedback.text}
                </div>
              )}

              <div className="mt-5 space-y-4">
                {showReviewsLoading && (
                  <div className={itemClassName}>
                    <p className="text-sm text-black">Loading reviews...</p>
                  </div>
                )}

                {!showReviewsLoading && reviewDisplayError && (
                  <div className={itemClassName}>
                    <p className="text-sm text-red-700">{reviewDisplayError}</p>
                  </div>
                )}

                {!showReviewsLoading && !reviewDisplayError && reviewItems.length > 0 && (
                  <>
                    {reviewItems.map((review) => {
                      const isEditing = editingReviewId === review.id
                      const isSaving = savingReviewId === review.id
                      const isDeleting = deletingReviewId === review.id
                      const isConfirmingDelete = confirmDeleteReviewId === review.id

                      return (
                        <article key={review.id} className={itemClassName}>
                          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                            <div className="min-w-0">
                              <p className="text-base font-semibold text-black">{review.businessName}</p>
                              <RatingStars rating={review.rating} labelId={review.id} />
                            </div>
                            <p className="text-sm text-slate-500">{formatDate(review.createdAt)}</p>
                          </div>

                          {isEditing ? (
                            <div className="mt-4 space-y-4">
                              <div>
                                <p className={mutedLabelClassName}>Rating</p>
                                <div className="mt-2 flex flex-wrap gap-2">
                                  {[1, 2, 3, 4, 5].map((ratingValue) => (
                                    <button
                                      key={`${review.id}-rating-${ratingValue}`}
                                      type="button"
                                      onClick={() => setEditRating(ratingValue)}
                                      className={`inline-flex h-9 w-9 items-center justify-center rounded-full border text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-slate-300/80 focus:ring-offset-2 focus:ring-offset-slate-50 ${
                                        editRating === ratingValue
                                          ? 'border-amber-400 bg-amber-50 text-amber-700'
                                          : 'border-[#c7d2df] bg-white text-black'
                                      }`}
                                      aria-label={`Set rating to ${ratingValue}`}
                                    >
                                      {ratingValue}
                                    </button>
                                  ))}
                                </div>
                              </div>

                              <label className="block">
                                <span className={mutedLabelClassName}>Review text</span>
                                <textarea
                                  value={editReviewText}
                                  onChange={(event) => setEditReviewText(event.target.value)}
                                  rows={4}
                                  className="mt-2 w-full rounded-2xl border border-[#c7d2df] bg-white px-4 py-3 text-sm text-black outline-none focus:ring-2 focus:ring-slate-300/80"
                                />
                              </label>

                              <div className="flex flex-col gap-3 sm:flex-row">
                                <button
                                  type="button"
                                  className={actionClassName}
                                  onClick={() => void saveReview(review)}
                                  disabled={isSaving || isDeleting}
                                >
                                  {isSaving ? 'Saving...' : 'Save Review'}
                                </button>
                                <button
                                  type="button"
                                  className={actionClassName}
                                  onClick={cancelEditingReview}
                                  disabled={isSaving}
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          ) : (
                            <>
                              <div className="mt-4">
                                <p className={mutedLabelClassName}>Review text</p>
                                <p className={valueClassName}>{review.reviewText || 'No written review provided.'}</p>
                              </div>

                              {review.ownerReply && (
                                <div className="mt-4 rounded-2xl border border-[#c7d2df] bg-white px-4 py-3">
                                  <p className={mutedLabelClassName}>Business reply</p>
                                  <p className={valueClassName}>{review.ownerReply.reply_text}</p>
                                </div>
                              )}

                              {isConfirmingDelete && (
                                <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3">
                                  <p className="text-sm font-medium text-red-700">
                                    Delete this review? This action cannot be undone.
                                  </p>
                                  <div className="mt-3 flex flex-col gap-3 sm:flex-row">
                                    <button
                                      type="button"
                                      className={destructiveActionClassName}
                                      onClick={() => void deleteReview(review)}
                                      disabled={isDeleting}
                                    >
                                      {isDeleting ? 'Deleting...' : 'Confirm Delete'}
                                    </button>
                                    <button
                                      type="button"
                                      className={actionClassName}
                                      onClick={() => setConfirmDeleteReviewId(null)}
                                      disabled={isDeleting}
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                </div>
                              )}

                              {!isConfirmingDelete && (
                                <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                                  <button
                                    type="button"
                                    className={actionClassName}
                                    onClick={() => startEditingReview(review)}
                                    disabled={isDeleting}
                                  >
                                    Edit Review
                                  </button>
                                  <button
                                    type="button"
                                    className={destructiveActionClassName}
                                    onClick={() => {
                                      setReviewFeedback(null)
                                      setEditingReviewId(null)
                                      setConfirmDeleteReviewId(review.id)
                                    }}
                                    disabled={isDeleting}
                                  >
                                    Delete Review
                                  </button>
                                </div>
                              )}
                            </>
                          )}
                        </article>
                      )
                    })}
                  </>
                )}

                {!showReviewsLoading && !reviewDisplayError && reviewItems.length === 0 && (
                  <div className={itemClassName}>
                    <p className="text-sm font-semibold text-black">No reviews yet.</p>
                    <p className="mt-1 text-sm text-black">Reviews you submit for businesses will appear here.</p>
                  </div>
                )}
              </div>
            </section>
          )}

          {activeTab === 'reports' && (
            <section className={sectionClassName}>
              <div>
                <h2 className="text-lg font-semibold tracking-tight text-black sm:text-xl">Reported Profiles</h2>
                <p className="mt-1 text-sm text-black">Profiles you have reported for review.</p>
              </div>

              <div className="mt-5 space-y-4">
                {showReportsLoading && (
                  <div className={itemClassName}>
                    <p className="text-sm text-black">Loading reported profiles...</p>
                  </div>
                )}

                {!showReportsLoading && reportDisplayError && (
                  <div className={itemClassName}>
                    <p className="text-sm text-red-700">{reportDisplayError}</p>
                  </div>
                )}

                {!showReportsLoading && !reportDisplayError && reportItems.length > 0 && (
                  <>
                    {reportItems.map((report) => (
                      <article key={report.id} className={itemClassName}>
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                          <div>
                            <p className="text-base font-semibold text-black">{report.businessName}</p>
                            <p className="mt-1 text-sm text-black">{report.reason}</p>
                          </div>
                          <span
                            className={`inline-flex self-start rounded-full px-3 py-1 text-xs font-semibold ${statusPillClass(
                              report.status
                            )}`}
                          >
                            {formatStatusLabel(report.status)}
                          </span>
                        </div>

                        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                          <div>
                            <p className={mutedLabelClassName}>Report reason</p>
                            <p className={valueClassName}>{report.reason}</p>
                          </div>
                          <div>
                            <p className={mutedLabelClassName}>Report date</p>
                            <p className={valueClassName}>{formatDate(report.createdAt)}</p>
                          </div>
                        </div>

                        {report.details && (
                          <div className="mt-4">
                            <p className={mutedLabelClassName}>Details</p>
                            <p className={valueClassName}>{report.details}</p>
                          </div>
                        )}
                      </article>
                    ))}
                  </>
                )}

                {!showReportsLoading && !reportDisplayError && reportItems.length === 0 && (
                  <div className={itemClassName}>
                    <p className="text-sm font-semibold text-black">No reported profiles yet.</p>
                    <p className="mt-1 text-sm text-black">Profiles you report will appear here.</p>
                  </div>
                )}
              </div>
            </section>
          )}

          {activeTab === 'corrections' && (
            <section className={sectionClassName}>
              <div>
                <h2 className="text-lg font-semibold tracking-tight text-black sm:text-xl">Submitted Corrections</h2>
                <p className="mt-1 text-sm text-black">Profile correction history is not available yet.</p>
              </div>
              <div className="mt-5">
                <div className={itemClassName}>
                  <p className="text-sm font-semibold text-black">No submitted corrections yet.</p>
                  <p className="mt-1 text-sm text-black">
                    Profile corrections are not available yet. Corrections you submit in the future will appear here.
                  </p>
                </div>
              </div>
            </section>
          )}
        </div>
      </main>
    </div>
  )
}

export default CustomerMyActivityPage
