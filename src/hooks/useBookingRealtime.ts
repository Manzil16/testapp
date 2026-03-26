import { useEffect } from "react";
import { supabase } from "../lib/supabase";

/**
 * Subscribes to realtime Postgres changes on a specific booking.
 * Replaces 30-second polling with instant push updates.
 */
export function useBookingRealtime(bookingId: string | undefined, onUpdate: () => void) {
  useEffect(() => {
    if (!bookingId) return;

    const channel = supabase
      .channel(`booking:${bookingId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "bookings",
          filter: `id=eq.${bookingId}`,
        },
        onUpdate
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [bookingId, onUpdate]);
}

/**
 * Subscribes to all booking changes for a given user (as driver or host).
 * Fires onUpdate whenever any of their bookings change status.
 */
export function useUserBookingsRealtime(userId: string | undefined, onUpdate: () => void) {
  useEffect(() => {
    if (!userId) return;

    const driverChannel = supabase
      .channel(`bookings-driver:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "bookings",
          filter: `driver_id=eq.${userId}`,
        },
        onUpdate
      )
      .subscribe();

    const hostChannel = supabase
      .channel(`bookings-host:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "bookings",
          filter: `host_id=eq.${userId}`,
        },
        onUpdate
      )
      .subscribe();

    return () => {
      supabase.removeChannel(driverChannel);
      supabase.removeChannel(hostChannel);
    };
  }, [userId, onUpdate]);
}
