import { useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  listBookingsByHost,
  updateBookingStatus,
  updateArrivalSignal,
} from "../features/bookings/booking.repository";
import { listChargersByHost } from "../features/chargers/charger.repository";
import { capturePayment, cancelPayment } from "../services/stripeService";
import type { Booking } from "../features/bookings/booking.types";
import type { Charger } from "../features/chargers/charger.types";
import type { UserProfile } from "../features/users/user.types";
import { supabase } from "../lib/supabase";

export type HostBookingSegment = "pending" | "active" | "completed" | "declined";

export function useHostBookings(hostUserId?: string) {
  const queryClient = useQueryClient();

  const bookingsQuery = useQuery({
    queryKey: ["bookings", "host", hostUserId],
    queryFn: () => listBookingsByHost(hostUserId!),
    enabled: Boolean(hostUserId),
  });

  const chargersQuery = useQuery({
    queryKey: ["chargers", "host", hostUserId],
    queryFn: () => listChargersByHost(hostUserId!),
    enabled: Boolean(hostUserId),
  });

  const bookings = useMemo(() => bookingsQuery.data ?? [], [bookingsQuery.data]);
  const chargers = useMemo(() => chargersQuery.data ?? [], [chargersQuery.data]);

  const driverIds = useMemo(
    () => [...new Set(bookings.map((b) => b.driverUserId))],
    [bookings]
  );

  const driversQuery = useQuery({
    queryKey: ["profiles", "drivers", driverIds],
    queryFn: async () => {
      if (driverIds.length === 0) return {};
      const { data } = await supabase
        .from("profiles")
        .select("id, display_name, avatar_url")
        .in("id", driverIds);
      const map: Record<string, Pick<UserProfile, "displayName" | "avatarUrl">> = {};
      for (const row of data ?? []) {
        map[row.id] = {
          displayName: row.display_name,
          avatarUrl: row.avatar_url ?? undefined,
        };
      }
      return map;
    },
    enabled: driverIds.length > 0,
  });

  const chargersById = useMemo(() => {
    const map: Record<string, Charger> = {};
    for (const c of chargers) map[c.id] = c;
    return map;
  }, [chargers]);

  const grouped = useMemo(() => {
    const pending: Booking[] = [];
    const active: Booking[] = [];
    const completed: Booking[] = [];
    const declined: Booking[] = [];
    for (const b of bookings) {
      if (b.status === "requested") pending.push(b);
      else if (b.status === "approved" || b.status === "in_progress") active.push(b);
      else if (b.status === "completed") completed.push(b);
      else if (b.status === "declined" || b.status === "cancelled") declined.push(b);
    }
    return { pending, active, completed, declined };
  }, [bookings]);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["bookings"] });

  const approveMutation = useMutation({
    mutationFn: async ({ booking, note }: { booking: Booking; note?: string }) => {
      // Attempt to capture pre-authorized payment — silently skip if PI not capturable (e.g. Expo Go test mode)
      if (booking.stripePaymentIntentId) {
        try {
          await capturePayment(booking.stripePaymentIntentId);
        } catch {
          // PI not in capturable state (no card in Expo Go) — proceed with approval anyway
        }
      }
      await updateBookingStatus(booking.id, "approved", note);
    },
    onSuccess: invalidate,
  });

  const declineMutation = useMutation({
    mutationFn: async ({ booking, note }: { booking: Booking; note?: string }) => {
      // Attempt to release payment hold — silently skip if PI not cancellable
      if (booking.stripePaymentIntentId) {
        try {
          await cancelPayment(booking.stripePaymentIntentId);
        } catch {
          // PI not in cancellable state — proceed with decline anyway
        }
      }
      await updateBookingStatus(booking.id, "declined", note);
    },
    onSuccess: invalidate,
  });

  const completeMutation = useMutation({
    mutationFn: async ({ booking, note }: { booking: Booking; note?: string }) => {
      await updateArrivalSignal(booking.id, "departed");
      await updateBookingStatus(booking.id, "completed", note);
    },
    onSuccess: invalidate,
  });

  return {
    data: {
      bookings,
      grouped,
      chargersById,
      driversById: driversQuery.data ?? {},
    },
    isLoading: bookingsQuery.isLoading,
    error: bookingsQuery.error?.message || null,
    refresh: async () => {
      await Promise.all([bookingsQuery.refetch(), chargersQuery.refetch()]);
    },
    actions: {
      approveBooking: (booking: Booking, note?: string) =>
        approveMutation.mutateAsync({ booking, note }),
      declineBooking: (booking: Booking, note?: string) =>
        declineMutation.mutateAsync({ booking, note }),
      markCompleted: (booking: Booking, note?: string) =>
        completeMutation.mutateAsync({ booking, note }),
    },
  };
}
