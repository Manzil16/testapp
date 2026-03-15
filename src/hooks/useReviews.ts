import { useCallback, useEffect, useMemo, useState } from "react";
import {
  createReview,
  listReviewsByCharger,
  listenToReviewsByCharger,
  type CreateReviewInput,
  type Review,
} from "@/src/features/reviews";

export function useReviews(chargerId?: string) {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!chargerId) {
      setReviews([]);
      setError(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    const unsubscribe = listenToReviewsByCharger(
      chargerId,
      (items) => {
        setReviews(items);
        setIsLoading(false);
      },
      (message) => {
        setError(message);
        setIsLoading(false);
      }
    );

    return unsubscribe;
  }, [chargerId]);

  const refresh = useCallback(async () => {
    if (!chargerId) {
      return;
    }

    try {
      setError(null);
      const result = await listReviewsByCharger(chargerId);
      setReviews(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to refresh reviews.");
    }
  }, [chargerId]);

  const submitReview = useCallback(
    async (input: CreateReviewInput) => {
      try {
        setError(null);
        await createReview(input);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unable to submit review.";
        setError(message);
        throw err;
      }
    },
    []
  );

  const averageRating = useMemo(() => {
    if (!reviews.length) {
      return null;
    }

    const total = reviews.reduce((sum, item) => sum + item.rating, 0);
    return total / reviews.length;
  }, [reviews]);

  return {
    data: {
      reviews,
      averageRating,
      totalReviews: reviews.length,
    },
    isLoading,
    error,
    refresh,
    submitReview,
  };
}
