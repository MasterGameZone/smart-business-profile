import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";
import { createPortal } from "react-dom";
import {
  createBusinessReview,
  createBusinessReviewReply,
  deleteBusinessReview,
  deleteBusinessReviewReply,
  getBusinessReviews,
  getReviewImagePublicUrl,
  updateBusinessReview,
  updateBusinessReviewReply,
} from "../lib/reviewService.ts";
import { validateImageFile } from "../lib/storageService.ts";
import type { BusinessReviewWithImages } from "../types/review.ts";

interface ReviewSectionProps {
  businessProfileId: string;
  businessOwnerId: string | null;
  userId: string | null;
  onLogin: () => void;
  onSummaryChange?: (summary: ReviewSummary) => void;
  triggerClassName?: string;
}

type ReviewAction = "create" | "update" | "delete";
type ReplyAction = "create" | "update" | "delete";
export interface ReviewSummary {
  average: number;
  count: number;
}

interface RatingDistributionRow {
  rating: number;
  count: number;
  percentage: number;
}
const MAX_REVIEW_IMAGES = 3;
const imageAccept = "image/jpeg,image/png,image/webp";

function formatReviewDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function getReviewSummary(reviews: BusinessReviewWithImages[]): ReviewSummary {
  if (reviews.length === 0) {
    return { average: 0, count: 0 };
  }

  const total = reviews.reduce((sum, review) => sum + review.rating, 0);
  return {
    average: Math.round((total / reviews.length) * 10) / 10,
    count: reviews.length,
  };
}

function getRatingDistribution(
  reviews: BusinessReviewWithImages[],
): RatingDistributionRow[] {
  const total = reviews.length;
  const counts = reviews.reduce<Record<number, number>>((result, review) => {
    result[review.rating] = (result[review.rating] ?? 0) + 1;
    return result;
  }, {});

  return [5, 4, 3, 2, 1].map((rating) => {
    const count = counts[rating] ?? 0;

    return {
      rating,
      count,
      percentage: total > 0 ? (count / total) * 100 : 0,
    };
  });
}

function StarIcon({ filled }: { filled: boolean }) {
  return (
    <svg
      className={`h-5 w-5 ${filled ? "text-amber-400" : "text-gray-300"}`}
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M9.05 2.93c.3-.92 1.6-.92 1.9 0l1.18 3.63a1 1 0 0 0 .95.69h3.82c.97 0 1.37 1.24.59 1.81l-3.09 2.24a1 1 0 0 0-.36 1.12l1.18 3.63c.3.92-.76 1.69-1.54 1.12l-3.09-2.24a1 1 0 0 0-1.18 0l-3.09 2.24c-.78.57-1.84-.2-1.54-1.12l1.18-3.63a1 1 0 0 0-.36-1.12L2.51 9.06c-.78-.57-.38-1.81.59-1.81h3.82a1 1 0 0 0 .95-.69l1.18-3.63z" />
    </svg>
  );
}

function StarDisplay({ rating, label }: { rating: number; label: string }) {
  const roundedRating = Math.round(rating);

  return (
    <div className="flex items-center gap-0.5" aria-label={label}>
      {[1, 2, 3, 4, 5].map((value) => (
        <StarIcon key={value} filled={value <= roundedRating} />
      ))}
    </div>
  );
}

function RatingSelector({
  value,
  onChange,
}: {
  value: number;
  onChange: (rating: number) => void;
}) {
  return (
    <div
      className="flex items-center gap-1"
      role="radiogroup"
      aria-label="Select rating"
    >
      {[1, 2, 3, 4, 5].map((rating) => (
        <button
          key={rating}
          type="button"
          role="radio"
          aria-checked={value === rating}
          aria-label={`${rating} star${rating === 1 ? "" : "s"}`}
          onClick={() => onChange(rating)}
          className="rounded-lg p-1 transition hover:bg-amber-50 focus:outline-none focus:ring-2 focus:ring-amber-300"
        >
          <StarIcon filled={rating <= value} />
        </button>
      ))}
    </div>
  );
}

function ReviewImageThumbnail({
  imageUrl,
  altText,
  onRemove,
}: {
  imageUrl: string;
  altText: string;
  onRemove: () => void;
}) {
  return (
    <div className="relative overflow-hidden rounded-xl border border-gray-100 bg-gray-50">
      <img
        src={imageUrl}
        alt={altText}
        className="aspect-square w-full object-cover"
      />
      <button
        type="button"
        onClick={onRemove}
        className="absolute right-1.5 top-1.5 rounded-full bg-white/95 px-2 py-1 text-xs font-medium text-red-600 shadow-sm transition hover:bg-white focus:outline-none focus:ring-2 focus:ring-red-200"
      >
        Remove
      </button>
    </div>
  );
}

function ReviewSection({
  businessProfileId,
  businessOwnerId,
  userId,
  onLogin,
  onSummaryChange,
  triggerClassName,
}: ReviewSectionProps) {
  const [reviews, setReviews] = useState<BusinessReviewWithImages[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [activeAction, setActiveAction] = useState<ReviewAction | null>(null);
  const [replyActionError, setReplyActionError] = useState<{
    reviewId: string;
    message: string;
  } | null>(null);
  const [activeReplyAction, setActiveReplyAction] = useState<{
    reviewId: string;
    action: ReplyAction;
  } | null>(null);
  const [activeReplyReviewId, setActiveReplyReviewId] = useState<string | null>(
    null,
  );
  const [replyText, setReplyText] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [rating, setRating] = useState(0);
  const [reviewText, setReviewText] = useState("");
  const [selectedImageFiles, setSelectedImageFiles] = useState<File[]>([]);
  const [selectedImagePreviews, setSelectedImagePreviews] = useState<
    Array<{ key: string; url: string; name: string }>
  >([]);
  const [removedImageIds, setRemovedImageIds] = useState<string[]>([]);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const selectedImagePreviewsRef = useRef<
    Array<{ key: string; url: string; name: string }>
  >([]);

  const ownReview = useMemo(
    () => reviews.find((review) => userId && review.user_id === userId) ?? null,
    [reviews, userId],
  );
  const summary = useMemo(() => getReviewSummary(reviews), [reviews]);
  const ratingDistribution = useMemo(
    () => getRatingDistribution(reviews),
    [reviews],
  );
  const canManageOwnerReplies = Boolean(
    userId && businessOwnerId && userId === businessOwnerId,
  );
  const isModalBusy =
    activeAction === "create" ||
    activeAction === "update" ||
    activeReplyAction?.action === "create" ||
    activeReplyAction?.action === "update";

  useEffect(() => {
    onSummaryChange?.(summary);
  }, [onSummaryChange, summary]);

  useEffect(() => {
    let cancelled = false;

    async function loadReviews() {
      setIsLoading(true);
      setLoadError(false);

      try {
        const loadedReviews = await getBusinessReviews(businessProfileId);
        if (cancelled) return;

        setReviews(loadedReviews);
      } catch (error) {
        if (cancelled) return;
        console.error("Failed to load business reviews:", error);
        setLoadError(true);
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    loadReviews();

    return () => {
      cancelled = true;
    };
  }, [businessProfileId]);

  useEffect(() => {
    selectedImagePreviewsRef.current = selectedImagePreviews;
  }, [selectedImagePreviews]);

  useEffect(() => {
    return () => {
      selectedImagePreviewsRef.current.forEach((preview) =>
        URL.revokeObjectURL(preview.url),
      );
    };
  }, []);

  useEffect(() => {
    if (!isModalOpen) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isModalOpen]);

  useEffect(() => {
    if (!isModalOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || isModalBusy) return;

      event.preventDefault();
      setIsModalOpen(false);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isModalBusy, isModalOpen]);

  const resetForm = () => {
    setRating(0);
    setReviewText("");
    selectedImagePreviews.forEach((preview) =>
      URL.revokeObjectURL(preview.url),
    );
    setSelectedImageFiles([]);
    setSelectedImagePreviews([]);
    setRemovedImageIds([]);
    setActionError(null);
    if (imageInputRef.current) {
      imageInputRef.current.value = "";
    }
  };

  const startEditing = (review: BusinessReviewWithImages) => {
    setRating(review.rating);
    setReviewText(review.review_text ?? "");
    selectedImagePreviews.forEach((preview) =>
      URL.revokeObjectURL(preview.url),
    );
    setSelectedImageFiles([]);
    setSelectedImagePreviews([]);
    setRemovedImageIds([]);
    setIsEditing(true);
    setActionError(null);
    if (imageInputRef.current) {
      imageInputRef.current.value = "";
    }
  };

  const cancelEditing = () => {
    setIsEditing(false);
    resetForm();
  };

  const closeReplyForm = () => {
    setActiveReplyReviewId(null);
    setReplyText("");
    setReplyActionError(null);
  };

  const startReply = (review: BusinessReviewWithImages) => {
    setActiveReplyReviewId(review.id);
    setReplyText(review.ownerReply?.reply_text ?? "");
    setReplyActionError(null);
  };

  const visibleExistingImages =
    ownReview && isEditing
      ? ownReview.images.filter((image) => !removedImageIds.includes(image.id))
      : [];
  const totalFormImages =
    visibleExistingImages.length + selectedImageFiles.length;

  const handleImageSelection = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    if (files.length === 0) return;

    if (totalFormImages + files.length > MAX_REVIEW_IMAGES) {
      setActionError("You can upload up to 3 images.");
      if (imageInputRef.current) {
        imageInputRef.current.value = "";
      }
      return;
    }

    for (const file of files) {
      const validation = validateImageFile(file);
      if (!validation.valid) {
        setActionError(validation.error || "Invalid image file.");
        if (imageInputRef.current) {
          imageInputRef.current.value = "";
        }
        return;
      }
    }

    const nextPreviews = files.map((file) => ({
      key: `${file.name}-${file.lastModified}-${file.size}`,
      name: file.name,
      url: URL.createObjectURL(file),
    }));

    setSelectedImageFiles((currentFiles) => [...currentFiles, ...files]);
    setSelectedImagePreviews((currentPreviews) => [
      ...currentPreviews,
      ...nextPreviews,
    ]);
    setActionError(null);

    if (imageInputRef.current) {
      imageInputRef.current.value = "";
    }
  };

  const handleRemoveSelectedImage = (index: number) => {
    const preview = selectedImagePreviews[index];
    if (preview) {
      URL.revokeObjectURL(preview.url);
    }

    setSelectedImageFiles((currentFiles) =>
      currentFiles.filter((_, fileIndex) => fileIndex !== index),
    );
    setSelectedImagePreviews((currentPreviews) =>
      currentPreviews.filter((_, previewIndex) => previewIndex !== index),
    );
    setActionError(null);
  };

  const handleRemoveExistingImage = (imageId: string) => {
    setRemovedImageIds((currentIds) =>
      currentIds.includes(imageId) ? currentIds : [...currentIds, imageId],
    );
    setActionError(null);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!userId) return;

    if (rating < 1 || rating > 5) {
      setActionError("Please select a rating before submitting.");
      return;
    }

    if (totalFormImages > MAX_REVIEW_IMAGES) {
      setActionError("You can upload up to 3 images.");
      return;
    }

    setActionError(null);
    setActiveAction(ownReview && isEditing ? "update" : "create");

    try {
      if (ownReview && isEditing) {
        const updatedReview = await updateBusinessReview(
          ownReview.id,
          userId,
          {
            rating,
            review_text: reviewText,
          },
          ownReview.images,
          removedImageIds,
          selectedImageFiles,
        );

        setReviews((currentReviews) =>
          currentReviews.map((review) =>
            review.id === updatedReview.id ? updatedReview : review,
          ),
        );
        setIsEditing(false);
        resetForm();
        return;
      }

      const createdReview = await createBusinessReview(
        userId,
        businessProfileId,
        rating,
        reviewText,
        selectedImageFiles,
      );

      setReviews((currentReviews) => {
        const withoutDuplicate = currentReviews.filter(
          (review) =>
            review.id !== createdReview.id && review.user_id !== userId,
        );
        return [createdReview, ...withoutDuplicate];
      });
      resetForm();
    } catch (error) {
      console.error("Failed to save business review:", error);
      setActionError(
        ownReview && isEditing
          ? "Unable to update review right now."
          : "Unable to submit review right now.",
      );
    } finally {
      setActiveAction(null);
    }
  };

  const handleDelete = async (review: BusinessReviewWithImages) => {
    if (!userId) return;

    const confirmed = window.confirm("Delete your review?");
    if (!confirmed) return;

    setActionError(null);
    setActiveAction("delete");

    try {
      await deleteBusinessReview(review.id, userId, review.images);
      setReviews((currentReviews) =>
        currentReviews.filter(
          (currentReview) => currentReview.id !== review.id,
        ),
      );
      setIsEditing(false);
      resetForm();
    } catch (error) {
      console.error("Failed to delete business review:", error);
      setActionError("Unable to delete review right now.");
    } finally {
      setActiveAction(null);
    }
  };

  const handleReplySubmit = async (
    event: FormEvent<HTMLFormElement>,
    review: BusinessReviewWithImages,
  ) => {
    event.preventDefault();

    if (!canManageOwnerReplies || !userId) return;

    if (replyText.trim().length === 0) {
      setReplyActionError({
        reviewId: review.id,
        message: "Please enter a reply before submitting.",
      });
      return;
    }

    setReplyActionError(null);
    setActiveReplyAction({
      reviewId: review.id,
      action: review.ownerReply ? "update" : "create",
    });

    try {
      const savedReply = review.ownerReply
        ? await updateBusinessReviewReply(
            review.ownerReply.id,
            userId,
            replyText,
          )
        : await createBusinessReviewReply(
            userId,
            review.id,
            businessProfileId,
            replyText,
          );

      setReviews((currentReviews) =>
        currentReviews.map((currentReview) =>
          currentReview.id === review.id
            ? { ...currentReview, ownerReply: savedReply }
            : currentReview,
        ),
      );
      closeReplyForm();
    } catch (error) {
      console.error("Failed to save owner review reply:", error);
      setReplyActionError({
        reviewId: review.id,
        message: review.ownerReply
          ? "Unable to update reply right now."
          : "Unable to submit reply right now.",
      });
    } finally {
      setActiveReplyAction(null);
    }
  };

  const handleDeleteReply = async (review: BusinessReviewWithImages) => {
    if (!canManageOwnerReplies || !userId || !review.ownerReply) return;

    const confirmed = window.confirm("Delete this owner reply?");
    if (!confirmed) return;

    setReplyActionError(null);
    setActiveReplyAction({ reviewId: review.id, action: "delete" });

    try {
      await deleteBusinessReviewReply(review.ownerReply.id, userId);
      setReviews((currentReviews) =>
        currentReviews.map((currentReview) =>
          currentReview.id === review.id
            ? { ...currentReview, ownerReply: null }
            : currentReview,
        ),
      );
      if (activeReplyReviewId === review.id) {
        closeReplyForm();
      }
    } catch (error) {
      console.error("Failed to delete owner review reply:", error);
      setReplyActionError({
        reviewId: review.id,
        message: "Unable to delete reply right now.",
      });
    } finally {
      setActiveReplyAction(null);
    }
  };

  const showReviewForm = Boolean(userId) && (!ownReview || isEditing);
  const submitLabel = ownReview && isEditing ? "Save Changes" : "Submit Review";
  const defaultTriggerClassName =
    "inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2";
  const closeModal = () => {
    if (isModalBusy) return;
    setIsModalOpen(false);
  };
  const reviewInterface = (
    <section
      aria-label="Ratings and Reviews"
      className="rounded-2xl border border-gray-100 bg-white px-6 py-6 shadow-sm sm:px-8"
    >
      <div className="mb-5">
        <h2
          id="reviewModalTitle"
          className="text-xs font-semibold uppercase tracking-widest text-gray-400"
        >
          Ratings & Reviews
        </h2>

        <div className="mt-4 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-4">
          {summary.count > 0 ? (
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
              <div className="sm:min-w-[8rem]">
                <p className="text-2xl font-bold text-gray-900">
                  {summary.average.toFixed(1)}
                </p>
                <p className="mt-1 text-sm text-gray-500">
                  Based on {summary.count} review
                  {summary.count === 1 ? "" : "s"}
                </p>
                <div className="mt-2">
                  <StarDisplay
                    rating={summary.average}
                    label={`${summary.average.toFixed(1)} out of 5 average rating`}
                  />
                </div>
              </div>

              <div className="min-w-0 flex-1 space-y-2">
                {ratingDistribution.map((row) => (
                  <div
                    key={row.rating}
                    className="flex items-center gap-2.5 text-xs text-gray-600"
                  >
                    <span className="w-2 shrink-0 text-right font-medium text-gray-700">
                      {row.rating}
                    </span>
                    <svg
                      className="h-3.5 w-3.5 shrink-0 text-amber-400"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                      aria-hidden="true"
                    >
                      <path d="M9.05 2.93c.3-.92 1.6-.92 1.9 0l1.18 3.63a1 1 0 0 0 .95.69h3.82c.97 0 1.37 1.24.59 1.81l-3.09 2.24a1 1 0 0 0-.36 1.12l1.18 3.63c.3.92-.76 1.69-1.54 1.12l-3.09-2.24a1 1 0 0 0-1.18 0l-3.09 2.24c-.78.57-1.84-.2-1.54-1.12l1.18-3.63a1 1 0 0 0-.36-1.12L2.51 9.06c-.78-.57-.38-1.81.59-1.81h3.82a1 1 0 0 0 .95-.69l1.18-3.63z" />
                    </svg>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-200">
                      <div
                        className="h-full rounded-full bg-blue-600"
                        style={{ width: `${row.percentage}%` }}
                        aria-hidden="true"
                      />
                    </div>
                    <span className="w-6 shrink-0 text-right font-medium text-gray-700">
                      {row.count}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
              <div className="sm:min-w-[8rem]">
                <p className="text-sm font-semibold text-gray-900">
                  No reviews yet.
                </p>
                <p className="mt-1 text-sm text-gray-500">
                  Be the first to rate this business.
                </p>
              </div>

              <div className="min-w-0 flex-1 space-y-2">
                {ratingDistribution.map((row) => (
                  <div
                    key={row.rating}
                    className="flex items-center gap-2.5 text-xs text-gray-600"
                  >
                    <span className="w-2 shrink-0 text-right font-medium text-gray-700">
                      {row.rating}
                    </span>
                    <svg
                      className="h-3.5 w-3.5 shrink-0 text-amber-400"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                      aria-hidden="true"
                    >
                      <path d="M9.05 2.93c.3-.92 1.6-.92 1.9 0l1.18 3.63a1 1 0 0 0 .95.69h3.82c.97 0 1.37 1.24.59 1.81l-3.09 2.24a1 1 0 0 0-.36 1.12l1.18 3.63c.3.92-.76 1.69-1.54 1.12l-3.09-2.24a1 1 0 0 0-1.18 0l-3.09 2.24c-.78.57-1.84-.2-1.54-1.12l1.18-3.63a1 1 0 0 0-.36-1.12L2.51 9.06c-.78-.57-.38-1.81.59-1.81h3.82a1 1 0 0 0 .95-.69l1.18-3.63z" />
                    </svg>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-200">
                      <div
                        className="h-full rounded-full bg-blue-600"
                        style={{ width: `${row.percentage}%` }}
                        aria-hidden="true"
                      />
                    </div>
                    <span className="w-6 shrink-0 text-right font-medium text-gray-700">
                      {row.count}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {loadError && (
        <p
          role="alert"
          className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          Unable to load reviews right now.
        </p>
      )}

      {isLoading ? (
        <p className="text-sm text-gray-500">Loading reviews...</p>
      ) : (
        <>
          {!userId && (
            <div className="mb-5 rounded-2xl border border-blue-100 bg-blue-50 px-4 py-4">
              <p className="text-sm font-medium text-blue-950">
                Log in to rate this business.
              </p>
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
            <form
              onSubmit={handleSubmit}
              className="mb-6 rounded-2xl border border-gray-100 bg-white px-4 py-4"
            >
              <div className="flex items-center justify-between gap-4">
                <label className="text-sm font-semibold text-gray-900">
                  Your rating
                </label>
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

              <label
                htmlFor="reviewText"
                className="mt-4 block text-sm font-semibold text-gray-900"
              >
                Review text{" "}
                <span className="font-normal text-gray-400">Optional</span>
              </label>
              <textarea
                id="reviewText"
                value={reviewText}
                onChange={(event) => setReviewText(event.target.value)}
                rows={3}
                placeholder="Share a short note about your experience."
                className="mt-2 w-full resize-y rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
              />

              <div className="mt-4">
                <label
                  htmlFor="reviewImages"
                  className="block text-sm font-semibold text-gray-900"
                >
                  Add photos{" "}
                  <span className="font-normal text-gray-400">Optional</span>
                </label>
                <input
                  ref={imageInputRef}
                  type="file"
                  id="reviewImages"
                  accept={imageAccept}
                  multiple
                  onChange={handleImageSelection}
                  disabled={totalFormImages >= MAX_REVIEW_IMAGES}
                  className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 file:mr-4 file:rounded-lg file:border-0 file:bg-gray-900 file:px-3 file:py-2 file:text-xs file:font-semibold file:text-white disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-400"
                />
                <p className="mt-2 text-xs text-gray-400">
                  Upload up to 3 images.
                </p>
              </div>

              {(visibleExistingImages.length > 0 ||
                selectedImagePreviews.length > 0) && (
                <div className="mt-4 grid grid-cols-3 gap-3">
                  {visibleExistingImages.map((image) => (
                    <ReviewImageThumbnail
                      key={image.id}
                      imageUrl={getReviewImagePublicUrl(image.image_path)}
                      altText="Saved review image"
                      onRemove={() => handleRemoveExistingImage(image.id)}
                    />
                  ))}

                  {selectedImagePreviews.map((preview, index) => (
                    <ReviewImageThumbnail
                      key={preview.key}
                      imageUrl={preview.url}
                      altText={preview.name}
                      onRemove={() => handleRemoveSelectedImage(index)}
                    />
                  ))}
                </div>
              )}

              {actionError && (
                <p role="alert" className="mt-3 text-sm text-red-600">
                  {actionError}
                </p>
              )}

              <button
                type="submit"
                disabled={
                  activeAction === "create" || activeAction === "update"
                }
                className="mt-4 inline-flex w-full items-center justify-center rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-70 sm:w-auto"
              >
                {activeAction === "create" || activeAction === "update"
                  ? "Saving..."
                  : submitLabel}
              </button>
            </form>
          )}

          {actionError && !showReviewForm && (
            <p
              role="alert"
              className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700"
            >
              {actionError}
            </p>
          )}

          {reviews.length > 0 && (
            <ul className="space-y-4">
              {reviews.map((review) => {
                const isOwnReview = Boolean(
                  userId && review.user_id === userId,
                );
                const displayDate = formatReviewDate(
                  review.updated_at || review.created_at,
                );
                const displayReplyDate = review.ownerReply
                  ? formatReviewDate(
                      review.ownerReply.updated_at ||
                        review.ownerReply.created_at,
                    )
                  : "";
                const isReplyFormOpen = activeReplyReviewId === review.id;
                const currentReplyAction =
                  activeReplyAction?.reviewId === review.id
                    ? activeReplyAction.action
                    : null;
                const replyErrorMessage =
                  replyActionError?.reviewId === review.id
                    ? replyActionError.message
                    : null;

                return (
                  <li
                    key={review.id}
                    className="border-t border-gray-100 pt-4 first:border-t-0 first:pt-0"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-sm font-semibold text-gray-900">
                          {isOwnReview ? "Your review" : "Customer"}
                        </p>
                        {displayDate && (
                          <p className="mt-0.5 text-xs text-gray-400">
                            {displayDate}
                          </p>
                        )}
                      </div>
                      <StarDisplay
                        rating={review.rating}
                        label={`${review.rating} out of 5 rating`}
                      />
                    </div>

                    {review.review_text ? (
                      <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-gray-700">
                        {review.review_text}
                      </p>
                    ) : review.images.length === 0 ? (
                      <p className="mt-3 text-sm text-gray-500">Rating only.</p>
                    ) : null}

                    {review.images.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {review.images.map((image, index) => (
                          <img
                            key={image.id}
                            src={getReviewImagePublicUrl(image.image_path)}
                            alt={`Review image ${index + 1}`}
                            className="h-20 w-20 rounded-xl border border-gray-100 object-cover"
                            loading="lazy"
                          />
                        ))}
                      </div>
                    )}

                    {review.ownerReply && (
                      <div className="mt-4 rounded-2xl border border-blue-100 bg-blue-50/70 px-4 py-3">
                        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                          <p className="text-xs font-semibold uppercase tracking-widest text-blue-900">
                            Response from owner
                          </p>
                          {displayReplyDate && (
                            <p className="text-xs text-blue-700/70">
                              {displayReplyDate}
                            </p>
                          )}
                        </div>
                        <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-blue-950">
                          {review.ownerReply.reply_text}
                        </p>
                      </div>
                    )}

                    {canManageOwnerReplies && isReplyFormOpen && (
                      <form
                        onSubmit={(event) => handleReplySubmit(event, review)}
                        className="mt-4 rounded-2xl border border-gray-100 bg-slate-50 px-4 py-4"
                      >
                        <label
                          htmlFor={`ownerReply-${review.id}`}
                          className="block text-sm font-semibold text-gray-900"
                        >
                          Owner reply
                        </label>
                        <textarea
                          id={`ownerReply-${review.id}`}
                          value={replyText}
                          onChange={(event) => setReplyText(event.target.value)}
                          rows={3}
                          placeholder="Write a public response to this review..."
                          className="mt-2 w-full resize-y rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                        />

                        {replyErrorMessage && (
                          <p role="alert" className="mt-3 text-sm text-red-600">
                            {replyErrorMessage}
                          </p>
                        )}

                        <div className="mt-4 flex flex-wrap gap-3">
                          <button
                            type="submit"
                            disabled={
                              currentReplyAction === "create" ||
                              currentReplyAction === "update"
                            }
                            className="inline-flex items-center justify-center rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-70"
                          >
                            {currentReplyAction === "create" ||
                            currentReplyAction === "update"
                              ? "Saving..."
                              : review.ownerReply
                                ? "Save Reply"
                                : "Submit Reply"}
                          </button>
                          <button
                            type="button"
                            onClick={closeReplyForm}
                            className="inline-flex items-center justify-center rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-600 transition hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-300 focus:ring-offset-2"
                          >
                            Cancel
                          </button>
                        </div>
                      </form>
                    )}

                    {replyErrorMessage && !isReplyFormOpen && (
                      <p role="alert" className="mt-3 text-sm text-red-600">
                        {replyErrorMessage}
                      </p>
                    )}

                    {canManageOwnerReplies && !isReplyFormOpen && (
                      <div className="mt-3 flex flex-wrap gap-3">
                        {review.ownerReply ? (
                          <>
                            <button
                              type="button"
                              onClick={() => startReply(review)}
                              className="text-sm font-medium text-blue-600 hover:text-blue-700 focus:outline-none focus:underline"
                            >
                              Edit Reply
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteReply(review)}
                              disabled={currentReplyAction === "delete"}
                              className="text-sm font-medium text-red-600 hover:text-red-700 focus:outline-none focus:underline disabled:cursor-not-allowed disabled:opacity-70"
                            >
                              {currentReplyAction === "delete"
                                ? "Deleting..."
                                : "Delete Reply"}
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            onClick={() => startReply(review)}
                            className="text-sm font-medium text-blue-600 hover:text-blue-700 focus:outline-none focus:underline"
                          >
                            Reply
                          </button>
                        )}
                      </div>
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
                          disabled={activeAction === "delete"}
                          className="text-sm font-medium text-red-600 hover:text-red-700 focus:outline-none focus:underline disabled:cursor-not-allowed disabled:opacity-70"
                        >
                          {activeAction === "delete"
                            ? "Deleting..."
                            : "Delete Review"}
                        </button>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}
    </section>
  );

  return (
    <>
      <div className="flex">
        <button
          type="button"
          onClick={() => setIsModalOpen(true)}
          aria-haspopup="dialog"
          aria-expanded={isModalOpen}
          aria-controls="review-modal"
          className={triggerClassName ?? defaultTriggerClassName}
        >
          <span className="inline-flex items-center gap-1.5">
            <svg
              className="h-4 w-4 shrink-0 text-violet-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M11 5H6a2 2 0 00-2 2v11l4-2 4 2 4-2 4 2V7a2 2 0 00-2-2h-5m-2 0V3m0 2h2m-2 0H9"
              />
            </svg>
            <span>Write a Review</span>
          </span>
        </button>
      </div>

      {isModalOpen &&
        createPortal(
          <div
            className="fixed inset-0 z-[100] flex items-end justify-center bg-slate-950/45 p-0 sm:items-center sm:p-4"
            onClick={(event) => {
              if (event.target === event.currentTarget) {
                closeModal();
              }
            }}
          >
            <div
              id="review-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="reviewModalTitle"
              className="relative w-full max-w-2xl overflow-hidden rounded-t-[1.75rem] bg-white shadow-2xl sm:rounded-[1.75rem]"
            >
              <button
                type="button"
                onClick={closeModal}
                disabled={isModalBusy}
                aria-label="Close ratings and reviews"
                className="absolute right-4 top-4 z-10 inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/95 text-slate-500 shadow-sm transition hover:bg-white hover:text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-70"
              >
                <svg
                  className="h-5 w-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>

              <div className="max-h-[88vh] overflow-y-auto">
                {reviewInterface}
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}

export default ReviewSection;
