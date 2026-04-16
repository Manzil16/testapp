import { useEffect, useRef } from "react";
import { supabase } from "../lib/supabase";

/**
 * Subscribes to realtime Postgres changes on a specific booking.
 * Replaces 30-second polling with instant push updates.
 *
 * onUpdate is stored in a ref so that a new function reference on the
 * parent's re-render never tears down and re-creates the subscription.
 */
export function useBookingRealtime(bookingId: string | undefined, onUpdate: () => void) {
  const onUpdateRef = useRef(onUpdate);
  onUpdateRef.current = onUpdate;

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
        () => onUpdateRef.current()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [bookingId]); // stable: only re-subscribe when bookingId changes
}

/**
 * Subscribes to all booking changes for a given user (as driver or host).
 * Fires onUpdate whenever any of their bookings change status.
 */
export function useUserBookingsRealtime(userId: string | undefined, onUpdate: () => void) {
  const onUpdateRef = useRef(onUpdate);
  onUpdateRef.current = onUpdate;

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
        () => onUpdateRef.current()
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
        () => onUpdateRef.current()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(driverChannel);
      supabase.removeChannel(hostChannel);
    };
  }, [userId]); // stable: only re-subscribe when userId changes
}
