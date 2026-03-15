import { useCallback, useEffect, useMemo, useState } from "react";
import {
  listBookingsByHost,
  listenToBookingsByHost,
  updateBookingStatus,
  type Booking,
} from "@/src/features/bookings";
import { listenToHostChargers, type Charger } from "@/src/features/chargers";
import { createNotification } from "@/src/features/notifications";
import { getUserProfile, type UserProfile } from "@/src/features/users";

export type HostBookingSegment = "pending" | "active" | "completed" | "declined";

export function useHostBookings(hostUserId?: string) {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [chargersById, setChargersById] = useState<Record<string, Charger>>({});
  const [driversById, setDriversById] = useState<Record<string, Pick<UserProfile, "displayName" | "avatarUrl">>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!hostUserId) {
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

    const unsubBookings = listenToBookingsByHost(
      hostUserId,
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

    const unsubChargers = listenToHostChargers(
      hostUserId,
      (items) => {
        setChargersById(Object.fromEntries(items.map((item) => [item.id, item])));
        chargersReady = true;
        markReady();
      },
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
  }, [hostUserId]);

  // Fetch driver profiles for bookings
  useEffect(() => {
    const driverIds = [...new Set(bookings.map((b) => b.driverUserId))];
    const missingIds = driverIds.filter((id) => !driversById[id]);

    if (missingIds.length === 0) return;

    let cancelled = false;

    Promise.all(
      missingIds.map(async (id) => {
        try {
          const profile = await getUserProfile(id);
          return profile ? { id, displayName: profile.displayName, avatarUrl: profile.avatarUrl } : null;
        } catch {
          return null;
        }
      })
    ).then((results) => {
      if (cancelled) return;
      setDriversById((prev) => {
        const next = { ...prev };
        for (const r of results) {
          if (r) next[r.id] = { displayName: r.displayName, avatarUrl: r.avatarUrl };
        }
        return next;
      });
    });

    return () => { cancelled = true; };
  }, [bookings]);

  const refresh = useCallback(async () => {
    if (!hostUserId) {
      return;
    }

    try {
      setError(null);
      const result = await listBookingsByHost(hostUserId);
      setBookings(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to refresh host bookings.");
    }
  }, [hostUserId]);

  const grouped = useMemo(() => {
    const pending = bookings.filter((item) => item.status === "requested");
    const active = bookings.filter((item) =>
      ["approved", "in_progress"].includes(item.status)
    );
    const completed = bookings.filter((item) => item.status === "completed");
    const declined = bookings.filter((item) =>
      ["declined", "cancelled"].includes(item.status)
    );

    return {
      pending,
      active,
      completed,
      declined,
    };
  }, [bookings]);

  const notifyDriver = useCallback(
    async (booking: Booking, nextStatus: Booking["status"]) => {
      try {
        await createNotification({
          userId: booking.driverUserId,
          type: "booking",
          title: `Booking ${nextStatus}`,
          body: `Your booking at ${chargersById[booking.chargerId]?.name || "charger"} is now ${nextStatus}.`,
          metadata: {
            bookingId: booking.id,
            status: nextStatus,
          },
        });
      } catch {
        // Status transitions are authoritative; notification delivery should not block them.
      }
    },
    [chargersById]
  );

  const approveBooking = useCallback(
    async (booking: Booking, note = "Approved by host") => {
      await updateBookingStatus(booking.id, "approved", note);
      await notifyDriver(booking, "approved");
    },
    [notifyDriver]
  );

  const declineBooking = useCallback(
    async (booking: Booking, note = "Declined by host") => {
      await updateBookingStatus(booking.id, "declined", note);
      await notifyDriver(booking, "declined");
    },
    [notifyDriver]
  );

  const markCompleted = useCallback(
    async (booking: Booking, note = "Completed by host") => {
      await updateBookingStatus(booking.id, "completed", note);
      await notifyDriver(booking, "completed");
    },
    [notifyDriver]
  );

  return {
    data: {
      bookings,
      grouped,
      chargersById,
      driversById,
    },
    isLoading,
    error,
    refresh,
    actions: {
      approveBooking,
      declineBooking,
      markCompleted,
    },
  };
}
