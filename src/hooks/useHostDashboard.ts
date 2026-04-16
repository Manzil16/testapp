import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { listBookingsByHost } from "../features/bookings/booking.repository";
import { listChargersByHost } from "../features/chargers/charger.repository";
import type { Booking } from "../features/bookings/booking.types";

export function useHostDashboard(userId?: string) {
  const chargersQuery = useQuery({
    queryKey: ["chargers", "host", userId],
    queryFn: () => listChargersByHost(userId!),
    enabled: Boolean(userId),
  });

  const bookingsQuery = useQuery({
    queryKey: ["bookings", "host", userId],
    queryFn: () => listBookingsByHost(userId!),
    enabled: Boolean(userId),
  });

  const chargers = useMemo(() => chargersQuery.data ?? [], [chargersQuery.data]);
  const bookings = useMemo(() => bookingsQuery.data ?? [], [bookingsQuery.data]);

  const { pendingBookings, activeSessions, completedThisMonth, estimatedRevenue } =
    useMemo(() => {
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const pending: Booking[] = [];
      const active: Booking[] = [];
      const completed: Booking[] = [];
      let revenue = 0;

      for (const b of bookings) {
        if (b.status === "requested") pending.push(b);
        else if (b.status === "active" || b.status === "approved") active.push(b);
        else if (
          b.status === "completed" &&
          new Date(b.createdAtIso) >= monthStart
        ) {
          completed.push(b);
          revenue += b.totalAmount - b.platformFee;
        }
      }
      return {
        pendingBookings: pending,
        activeSessions: active,
        completedThisMonth: completed,
        estimatedRevenue: revenue,
      };
    }, [bookings]);

  return {
    data: {
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
    },
    isLoading: chargersQuery.isLoading || bookingsQuery.isLoading,
    error: chargersQuery.error?.message || bookingsQuery.error?.message || null,
    refresh: async () => {
      await Promise.all([chargersQuery.refetch(), bookingsQuery.refetch()]);
    },
  };
}
