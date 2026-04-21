import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getChargerById } from "../features/chargers/charger.repository";
import { listReviewsByCharger } from "../features/reviews/review.repository";
import { createBookingRequest, listBookingsByDriver } from "../features/bookings/booking.repository";
import { getUserProfile } from "../features/users/user.repository";
import type { Booking } from "../features/bookings/booking.types";
import type { Charger } from "../features/chargers/charger.types";

function isOcmId(id: string | undefined): boolean {
  return !!id && id.startsWith("ocm-");
}

function findOcmChargerInCache(queryClient: ReturnType<typeof useQueryClient>, chargerId: string): Charger | null {
  const entries = queryClient.getQueriesData<Charger[]>({ queryKey: ["chargers", "ocm"] });
  for (const [, data] of entries) {
    if (!data) continue;
    const match = data.find((c) => c.id === chargerId);
    if (match) return match;
  }
  return null;
}

const ACTIVE_STATUSES = new Set(["requested", "approved", "active"]);

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

export function getBookingAvailabilityError(
  charger: Charger | null,
  start: Date,
  end: Date
): string | null {
  if (!charger) return "Charger not loaded.";
  if (end <= start) return "End time must be after start time.";
  if (start < new Date()) return "Start time cannot be in the past.";

  const window = charger.availabilityWindow;
  if (!window) return null; // no window means always available

  const dayName = DAY_NAMES[start.getDay()];
  if (!window.days.includes(dayName as any)) {
    return `This charger is not available on ${dayName}.`;
  }

  const toMinutes = (hhmm: string) => {
    const [h, m] = hhmm.split(":").map(Number);
    return h * 60 + m;
  };
  const startMinutes = start.getHours() * 60 + start.getMinutes();
  const endMinutes = end.getHours() * 60 + end.getMinutes();
  const winStart = toMinutes(window.startTime);
  const winEnd = toMinutes(window.endTime);

  if (startMinutes < winStart || endMinutes > winEnd) {
    return `Booking must be within ${window.startTime}–${window.endTime}.`;
  }

  return null;
}

interface RequestBookingInput {
  start: Date;
  end: Date;
  estimatedKWh: number;
  note?: string;
}

export function useChargerDetail(chargerId?: string, driverUserId?: string) {
  const queryClient = useQueryClient();
  const isOcm = isOcmId(chargerId);

  const chargerQuery = useQuery({
    queryKey: ["charger", chargerId],
    queryFn: async () => {
      if (isOcm) {
        return findOcmChargerInCache(queryClient, chargerId!);
      }
      return getChargerById(chargerId!);
    },
    enabled: Boolean(chargerId),
  });

  const reviewsQuery = useQuery({
    queryKey: ["reviews", chargerId],
    queryFn: () => listReviewsByCharger(chargerId!),
    enabled: Boolean(chargerId) && !isOcm,
  });

  const hostId = chargerQuery.data?.hostUserId;
  const hostQuery = useQuery({
    queryKey: ["profile", hostId],
    queryFn: async () => {
      if (!hostId) return null;
      return getUserProfile(hostId);
    },
    enabled: Boolean(hostId) && hostId !== "ocm",
  });

  // Fetch driver's active booking for this charger
  const driverBookingsQuery = useQuery({
    queryKey: ["bookings", "driver", driverUserId, chargerId],
    queryFn: async () => {
      if (!driverUserId || !chargerId) return null;
      const all = await listBookingsByDriver(driverUserId);
      return all.find(
        (b) => b.chargerId === chargerId && ACTIVE_STATUSES.has(b.status)
      ) ?? null;
    },
    enabled: Boolean(driverUserId) && Boolean(chargerId) && !isOcm,
  });

  const reviews = reviewsQuery.data ?? [];
  const totalReviews = reviews.length;
  const averageRating =
    totalReviews > 0
      ? reviews.reduce((sum, r) => sum + r.rating, 0) / totalReviews
      : null;

  const bookingMutation = useMutation({
    mutationFn: async (input: RequestBookingInput) => {
      if (!chargerId || !driverUserId || !chargerQuery.data?.hostUserId) {
        throw new Error("Missing charger or user info");
      }
      return createBookingRequest({
        chargerId,
        driverUserId,
        hostUserId: chargerQuery.data.hostUserId,
        startTimeIso: input.start.toISOString(),
        endTimeIso: input.end.toISOString(),
        estimatedKWh: input.estimatedKWh,
        note: input.note,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bookings"] });
    },
  });

  return {
    data: {
      charger: chargerQuery.data ?? null,
      hostName: isOcm ? "Public network" : (hostQuery.data?.displayName ?? "Host"),
      hostStripeAccountId: hostQuery.data?.stripeAccountId ?? null,
      reviews,
      averageRating,
      totalReviews,
      availabilityStatus: "available" as Booking["status"] | "available",
      activeBooking: driverBookingsQuery.data ?? null,
      isOcm,
    },
    isLoading: chargerQuery.isLoading,
    error: chargerQuery.error?.message || null,
    refresh: async () => {
      await Promise.all([chargerQuery.refetch(), reviewsQuery.refetch()]);
    },
    requestBooking: (input: RequestBookingInput) => bookingMutation.mutateAsync(input),
  };
}
