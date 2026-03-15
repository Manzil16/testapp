import { useCallback, useEffect, useMemo, useState } from "react";
import {
  createBookingRequest,
  type Booking,
} from "@/src/features/bookings";
import {
  getChargerById,
  listenToChargers,
  type Charger,
} from "@/src/features/chargers";
import { createNotification } from "@/src/features/notifications";
import { listenToUserProfile } from "@/src/features/users";
import { useReviews } from "@/src/hooks/useReviews";

interface RequestBookingInput {
  start: Date;
  end: Date;
  estimatedKWh: number;
  note?: string;
}

function parseTimeToMinutes(value: string): number | null {
  const [hoursRaw, minutesRaw] = value.split(":");
  const hours = Number(hoursRaw);
  const minutes = Number(minutesRaw);
  if (
    !Number.isInteger(hours) ||
    !Number.isInteger(minutes) ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59
  ) {
    return null;
  }
  return hours * 60 + minutes;
}

const weekdayByIndex: NonNullable<Charger["availabilityWindow"]>["days"] = [
  "Sun",
  "Mon",
  "Tue",
  "Wed",
  "Thu",
  "Fri",
  "Sat",
];

function parseAvailabilityFromNote(charger: Charger): Charger["availabilityWindow"] {
  if (!charger.availabilityNote) {
    return undefined;
  }

  const timeMatch = charger.availabilityNote.match(/(\d{2}:\d{2})\s*-\s*(\d{2}:\d{2})/);
  if (!timeMatch) {
    return undefined;
  }

  const dayMatches = charger.availabilityNote.match(/\b(Mon|Tue|Wed|Thu|Fri|Sat|Sun)\b/g);
  if (!dayMatches?.length) {
    return undefined;
  }

  return {
    days: Array.from(new Set(dayMatches)) as NonNullable<Charger["availabilityWindow"]>["days"],
    startTime: timeMatch[1],
    endTime: timeMatch[2],
  };
}

function isWithinAvailability(charger: Charger, at: Date): boolean {
  const window = charger.availabilityWindow || parseAvailabilityFromNote(charger);
  if (!window) {
    return true;
  }

  const dayKey = weekdayByIndex[at.getDay()];
  if (!window.days.includes(dayKey)) {
    return false;
  }

  const startMinutes = parseTimeToMinutes(window.startTime);
  const endMinutes = parseTimeToMinutes(window.endTime);
  if (startMinutes === null || endMinutes === null) {
    return false;
  }

  const instantMinutes = at.getHours() * 60 + at.getMinutes();
  if (startMinutes <= endMinutes) {
    return instantMinutes >= startMinutes && instantMinutes <= endMinutes;
  }

  return instantMinutes >= startMinutes || instantMinutes <= endMinutes;
}

export function getBookingAvailabilityError(
  charger: Charger | null,
  start: Date,
  end: Date
): string | null {
  if (!charger) {
    return "Charger is unavailable.";
  }

  if (end.getTime() <= start.getTime()) {
    return "End time must be after start time.";
  }

  if (!isWithinAvailability(charger, start)) {
    return "Start time is outside host availability.";
  }

  if (!isWithinAvailability(charger, end)) {
    return "End time is outside host availability.";
  }

  return null;
}

export function useChargerDetail(chargerId?: string, driverUserId?: string) {
  const [charger, setCharger] = useState<Charger | null>(null);
  const [hostName, setHostName] = useState<string>("Host");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reviewsState = useReviews(chargerId);

  useEffect(() => {
    if (!chargerId) {
      setCharger(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    const unsubscribe = listenToChargers(
      (items) => {
        const item = items.find((candidate) => candidate.id === chargerId) || null;
        setCharger(item);
        setIsLoading(false);
      },
      undefined,
      (message) => {
        setError(message);
        setIsLoading(false);
      }
    );

    return unsubscribe;
  }, [chargerId]);

  useEffect(() => {
    if (!charger?.hostUserId) {
      setHostName("Host");
      return;
    }

    const unsubscribe = listenToUserProfile(
      charger.hostUserId,
      (profile) => {
        setHostName(profile?.displayName || "Host");
      },
      (message) => {
        setError(message);
      }
    );

    return unsubscribe;
  }, [charger?.hostUserId]);

  const refresh = useCallback(async () => {
    if (!chargerId) {
      return;
    }

    try {
      setError(null);
      const latest = await getChargerById(chargerId);
      setCharger(latest);
      await reviewsState.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to refresh charger details.");
    }
  }, [chargerId, reviewsState]);

  const requestBooking = useCallback(
    async (input: RequestBookingInput) => {
      if (!charger || !driverUserId) {
        throw new Error("You must be signed in to request a booking.");
      }

      try {
        setError(null);
        const availabilityError = getBookingAvailabilityError(charger, input.start, input.end);
        if (availabilityError) {
          throw new Error(availabilityError);
        }

        const bookingId = await createBookingRequest({
          chargerId: charger.id,
          driverUserId,
          hostUserId: charger.hostUserId,
          startTimeIso: input.start.toISOString(),
          endTimeIso: input.end.toISOString(),
          estimatedKWh: Math.max(5, input.estimatedKWh),
          note: input.note?.trim() || "",
        });

        try {
          await createNotification({
            userId: charger.hostUserId,
            type: "booking",
            title: "New booking request",
            body: `A driver requested ${charger.name}.`,
            metadata: {
              bookingId,
              chargerId: charger.id,
            },
          });
        } catch {
          // Notification permissions can vary; booking creation remains the source-of-truth action.
        }

        return bookingId;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unable to request booking.";
        setError(message);
        throw err;
      }
    },
    [charger, driverUserId]
  );

  const availabilityStatus: Booking["status"] | "available" = useMemo(() => {
    if (!charger) {
      return "available";
    }

    if (charger.status === "suspended" || charger.status === "rejected") {
      return "declined";
    }

    if (charger.status === "pending_verification") {
      return "requested";
    }

    return "available";
  }, [charger]);

  return {
    data: {
      charger,
      hostName,
      reviews: reviewsState.data.reviews,
      averageRating: reviewsState.data.averageRating,
      totalReviews: reviewsState.data.totalReviews,
      availabilityStatus,
    },
    isLoading: isLoading || reviewsState.isLoading,
    error: error || reviewsState.error,
    refresh,
    requestBooking,
  };
}
