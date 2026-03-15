import { useCallback, useEffect, useMemo, useState } from "react";
import { listenToBookingsByHost, type Booking } from "@/src/features/bookings";
import { listChargersByHost, listenToHostChargers, type Charger } from "@/src/features/chargers";

export function useHostDashboard(userId?: string) {
  const [chargers, setChargers] = useState<Charger[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) {
      setChargers([]);
      setBookings([]);
      setError(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    let chargersReady = false;
    let bookingsReady = false;

    const markReady = () => {
      if (chargersReady && bookingsReady) {
        setIsLoading(false);
      }
    };

    const unsubChargers = listenToHostChargers(
      userId,
      (items) => {
        setChargers(items);
        chargersReady = true;
        markReady();
      },
      (message) => {
        setError(message);
        chargersReady = true;
        markReady();
      }
    );

    const unsubBookings = listenToBookingsByHost(
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

    return () => {
      unsubChargers();
      unsubBookings();
    };
  }, [userId]);

  const refresh = useCallback(async () => {
    if (!userId) {
      return;
    }

    try {
      setError(null);
      const latest = await listChargersByHost(userId);
      setChargers(latest);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to refresh host dashboard.");
    }
  }, [userId]);

  const data = useMemo(() => {
    const pendingBookings = bookings.filter((item) => item.status === "requested");
    const activeSessions = bookings.filter(
      (item) => item.status === "in_progress" || item.arrivalSignal === "charging"
    );

    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    const completedThisMonth = bookings.filter((item) => {
      if (item.status !== "completed") {
        return false;
      }

      const date = new Date(item.updatedAtIso);
      return date.getMonth() === currentMonth && date.getFullYear() === currentYear;
    });

    const chargerById = Object.fromEntries(chargers.map((item) => [item.id, item]));

    const estimatedRevenue = completedThisMonth.reduce((total, booking) => {
      const charger = chargerById[booking.chargerId];
      if (!charger) {
        return total;
      }

      return total + booking.estimatedKWh * charger.pricingPerKwh;
    }, 0);

    return {
      chargers,
      bookings,
      pendingBookings,
      activeSessions,
      completedThisMonth,
      estimatedRevenue,
      stats: {
        totalChargers: chargers.length,
        pendingBookings: pendingBookings.length,
        activeSessions: activeSessions.length,
        completedThisMonth: completedThisMonth.length,
      },
    };
  }, [bookings, chargers]);

  return {
    data,
    isLoading,
    error,
    refresh,
  };
}
