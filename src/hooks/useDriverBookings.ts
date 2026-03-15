import { useCallback, useEffect, useMemo, useState } from "react";
import {
  listBookingsByDriver,
  listenToBookingsByDriver,
  updateArrivalSignal,
  updateBookingStatus,
  type Booking,
} from "@/src/features/bookings";
import { listenToChargers, type Charger } from "@/src/features/chargers";
import { createReview } from "@/src/features/reviews";

export type DriverBookingSegment = "upcoming" | "active" | "past";

export function useDriverBookings(userId?: string) {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [chargersById, setChargersById] = useState<Record<string, Charger>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) {
      setBookings([]);
      setError(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    let bookingsReady = false;
    let chargersReady = false;

    const markReady = () => {
      if (bookingsReady && chargersReady) {
        setIsLoading(false);
      }
    };

    const unsubBookings = listenToBookingsByDriver(
      userId,
      (items) => {
        setBookings(items);
        bookingsReady = true;
        markReady();
      },
      (message) => {
        setError(message);
        bookingsReady = true;
        markReady();
      }
    );

    const unsubChargers = listenToChargers(
      (items) => {
        setChargersById(
          Object.fromEntries(items.map((item) => [item.id, item]))
        );
        chargersReady = true;
        markReady();
      },
      undefined,
      (message) => {
        setError(message);
        chargersReady = true;
        markReady();
      }
    );

    return () => {
      unsubBookings();
      unsubChargers();
    };
  }, [userId]);

  const refresh = useCallback(async () => {
    if (!userId) {
      return;
    }

    try {
      setError(null);
      const result = await listBookingsByDriver(userId);
      setBookings(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to refresh bookings.");
    }
  }, [userId]);

  const bySegment = useMemo(() => {
    const now = Date.now();

    const upcoming = bookings.filter((booking) => {
      const startTs = new Date(booking.startTimeIso).getTime();
      return (
        (booking.status === "requested" || booking.status === "approved") &&
        startTs > now
      );
    });

    const active = bookings.filter(
      (booking) =>
        booking.status === "in_progress" ||
        booking.arrivalSignal === "arrived" ||
        booking.arrivalSignal === "charging"
    );

    const past = bookings.filter((booking) =>
      ["completed", "declined", "cancelled"].includes(booking.status)
    );

    return {
      upcoming,
      active,
      past,
    };
  }, [bookings]);

  const cancelBooking = useCallback(async (bookingId: string) => {
    await updateBookingStatus(bookingId, "cancelled", "Cancelled by driver");
  }, []);

  const markArrived = useCallback(async (bookingId: string) => {
    await updateArrivalSignal(bookingId, "arrived");
  }, []);

  const startCharging = useCallback(async (bookingId: string) => {
    await updateArrivalSignal(bookingId, "charging");
    await updateBookingStatus(bookingId, "in_progress", "Driver started charging");
  }, []);

  const leaveReview = useCallback(
    async (booking: Booking, rating: number, comment: string) => {
      await createReview({
        bookingId: booking.id,
        chargerId: booking.chargerId,
        driverUserId: booking.driverUserId,
        hostUserId: booking.hostUserId,
        rating,
        comment,
      });
    },
    []
  );

  return {
    data: {
      bookings,
      bySegment,
      chargersById,
    },
    isLoading,
    error,
    refresh,
    actions: {
      cancelBooking,
      markArrived,
      startCharging,
      leaveReview,
    },
  };
}
