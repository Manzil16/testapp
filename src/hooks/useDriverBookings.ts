import { useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  listBookingsByDriver,
  updateBookingStatus,
  updateArrivalSignal,
} from "../features/bookings/booking.repository";
import { listChargers } from "../features/chargers/charger.repository";
import { createReview, listReviewsByDriver } from "../features/reviews/review.repository";
import type { Booking } from "../features/bookings/booking.types";
import type { Charger } from "../features/chargers/charger.types";

export function useDriverBookings(userId?: string) {
  const queryClient = useQueryClient();

  const bookingsQuery = useQuery({
    queryKey: ["bookings", "driver", userId],
    queryFn: () => listBookingsByDriver(userId!),
    enabled: Boolean(userId),
  });

  // Fetch ALL chargers (not just approved) so bookings for pending/rejected chargers still resolve names
  const chargersQuery = useQuery({
    queryKey: ["chargers", "all-for-bookings"],
    queryFn: () => listChargers(),
    enabled: Boolean(userId),
  });

  const reviewsQuery = useQuery({
    queryKey: ["reviews", "driver", userId],
    queryFn: () => listReviewsByDriver(userId!),
    enabled: Boolean(userId),
  });

  const bookings = useMemo(() => bookingsQuery.data ?? [], [bookingsQuery.data]);
  const chargers = useMemo(() => chargersQuery.data ?? [], [chargersQuery.data]);
  const reviews = useMemo(() => reviewsQuery.data ?? [], [reviewsQuery.data]);

  const chargersById = useMemo(() => {
    const map: Record<string, Charger> = {};
    for (const c of chargers) map[c.id] = c;
    return map;
  }, [chargers]);

  const bySegment = useMemo(() => {
    const upcoming: Booking[] = [];
    const active: Booking[] = [];
    const past: Booking[] = [];
    for (const b of bookings) {
      if (b.status === "in_progress" || b.status === "approved") active.push(b);
      else if (b.status === "requested") upcoming.push(b);
      else past.push(b);
    }
    return { upcoming, active, past };
  }, [bookings]);

  const reviewedBookingIds = useMemo(() => {
    const set = new Set<string>();
    for (const review of reviews) {
      set.add(review.bookingId);
    }
    return set;
  }, [reviews]);

  const reviewRatingsByBookingId = useMemo(() => {
    const map: Record<string, number> = {};
    for (const review of reviews) {
      if (!(review.bookingId in map)) {
        map[review.bookingId] = review.rating;
      }
    }
    return map;
  }, [reviews]);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["bookings"] });

  const cancelMutation = useMutation({
    mutationFn: ({ bookingId, reason }: { bookingId: string; reason?: string }) =>
      updateBookingStatus(bookingId, "cancelled", undefined, reason),
    onSuccess: invalidate,
  });

  const arriveMutation = useMutation({
    mutationFn: (bookingId: string) => updateArrivalSignal(bookingId, "arrived"),
    onSuccess: invalidate,
  });

  const chargingMutation = useMutation({
    mutationFn: async (bookingId: string) => {
      await updateArrivalSignal(bookingId, "charging");
      await updateBookingStatus(bookingId, "in_progress");
    },
    onSuccess: invalidate,
  });

  const reviewMutation = useMutation({
    mutationFn: (input: { booking: Booking; rating: number; comment: string }) =>
      createReview({
        bookingId: input.booking.id,
        chargerId: input.booking.chargerId,
        driverUserId: input.booking.driverUserId,
        hostUserId: input.booking.hostUserId,
        rating: input.rating,
        comment: input.comment,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["reviews"] }),
  });

  return {
    data: { bookings, bySegment, chargersById },
    reviewedBookingIds,
    reviewRatingsByBookingId,
    isLoading: bookingsQuery.isLoading || reviewsQuery.isLoading,
    error: bookingsQuery.error?.message || null,
    refresh: async () => {
      await Promise.all([bookingsQuery.refetch(), chargersQuery.refetch(), reviewsQuery.refetch()]);
    },
    actions: {
      cancelBooking: (bookingId: string, reason?: string) =>
        cancelMutation.mutateAsync({ bookingId, reason }),
      markArrived: (bookingId: string) => arriveMutation.mutateAsync(bookingId),
      startCharging: (bookingId: string) => chargingMutation.mutateAsync(bookingId),
      leaveReview: (booking: Booking, rating: number, comment: string) =>
        reviewMutation.mutateAsync({ booking, rating, comment }),
    },
  };
}
