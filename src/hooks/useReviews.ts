import { useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  listReviewsByCharger,
  createReview,
} from "../features/reviews/review.repository";
import type { CreateReviewInput } from "../features/reviews/review.types";

export function useReviews(chargerId?: string) {
  const queryClient = useQueryClient();

  const reviewsQuery = useQuery({
    queryKey: ["reviews", chargerId],
    queryFn: () => listReviewsByCharger(chargerId!),
    enabled: Boolean(chargerId),
  });

  const reviews = useMemo(() => reviewsQuery.data ?? [], [reviewsQuery.data]);

  const { averageRating, totalReviews } = useMemo(() => {
    const total = reviews.length;
    if (total === 0) return { averageRating: null, totalReviews: 0 };
    const avg = reviews.reduce((sum, r) => sum + r.rating, 0) / total;
    return { averageRating: Math.round(avg * 10) / 10, totalReviews: total };
  }, [reviews]);

  const submitMutation = useMutation({
    mutationFn: (input: CreateReviewInput) => createReview(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reviews", chargerId] });
    },
  });

  return {
    data: { reviews, averageRating, totalReviews },
    isLoading: reviewsQuery.isLoading,
    error: reviewsQuery.error?.message || null,
    refresh: async () => {
      await reviewsQuery.refetch();
    },
    submitReview: (input: CreateReviewInput) => submitMutation.mutateAsync(input),
  };
}
