import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { listBookingsByDriver } from "@/src/features/bookings/booking.repository";
import { listTripsByUser } from "@/src/features/trips/trip.repository";
import { listReviewsByDriver } from "@/src/features/reviews/review.repository";

export interface Achievement {
  id: string;
  icon: string;
  label: string;
  desc: string;
  earned: boolean;
  progress?: string; // e.g., "2/5"
}

/**
 * Computes user achievements from real database data.
 * Replaces the hardcoded static achievement cards.
 */
export function useAchievements(userId: string | undefined) {
  const bookingsQuery = useQuery({
    queryKey: ["bookings", "driver", userId],
    queryFn: () => listBookingsByDriver(userId!),
    enabled: !!userId,
  });

  const tripsQuery = useQuery({
    queryKey: ["trips", "user", userId],
    queryFn: () => listTripsByUser(userId!),
    enabled: !!userId,
  });

  const reviewsQuery = useQuery({
    queryKey: ["reviews", "driver", userId],
    queryFn: () => listReviewsByDriver(userId!),
    enabled: !!userId,
  });

  const achievements = useMemo<Achievement[]>(() => {
    const completedBookings = (bookingsQuery.data ?? []).filter(
      (b) => b.status === "completed"
    );
    const totalKwh = completedBookings.reduce(
      (sum, b) => sum + b.estimatedKWh,
      0
    );
    const tripCount = (tripsQuery.data ?? []).length;
    const reviewCount = (reviewsQuery.data ?? []).length;

    return [
      {
        id: "first_charge",
        icon: "⚡",
        label: "First Charge",
        desc: "Completed your first session",
        earned: completedBookings.length >= 1,
        progress: completedBookings.length >= 1 ? undefined : `${completedBookings.length}/1`,
      },
      {
        id: "100kwh",
        icon: "🔋",
        label: "100 kWh Club",
        desc: "Charged 100+ kWh total",
        earned: totalKwh >= 100,
        progress: totalKwh >= 100 ? undefined : `${Math.round(totalKwh)}/100 kWh`,
      },
      {
        id: "5_trips",
        icon: "🗺️",
        label: "Road Warrior",
        desc: "Planned 5+ trips",
        earned: tripCount >= 5,
        progress: tripCount >= 5 ? undefined : `${tripCount}/5`,
      },
      {
        id: "reviewer",
        icon: "⭐",
        label: "Top Reviewer",
        desc: "Left 3+ reviews",
        earned: reviewCount >= 3,
        progress: reviewCount >= 3 ? undefined : `${reviewCount}/3`,
      },
    ];
  }, [bookingsQuery.data, tripsQuery.data, reviewsQuery.data]);

  return { achievements, isLoading: bookingsQuery.isLoading };
}
