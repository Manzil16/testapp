import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/src/lib/supabase";
import { getBookingById } from "@/src/features/bookings/booking.repository";
import { getChargerById } from "@/src/features/chargers/charger.repository";
import type { Booking } from "@/src/features/bookings/booking.types";
import type { Charger } from "@/src/features/chargers/charger.types";

export function useBookingDetail(bookingId: string) {
  const queryClient = useQueryClient();

  const bookingQuery = useQuery({
    queryKey: ["booking", bookingId],
    queryFn: () => getBookingById(bookingId),
    enabled: !!bookingId,
  });

  const chargerQuery = useQuery({
    queryKey: ["charger", bookingQuery.data?.chargerId],
    queryFn: () => getChargerById(bookingQuery.data!.chargerId),
    enabled: !!bookingQuery.data?.chargerId,
  });

  // Realtime subscription for live booking updates
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
        () => {
          // Invalidate to re-fetch with proper mapRow transformation
          queryClient.invalidateQueries({ queryKey: ["booking", bookingId] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [bookingId, queryClient]);

  return {
    booking: bookingQuery.data as Booking | null | undefined,
    charger: chargerQuery.data as Charger | null | undefined,
    isLoading: bookingQuery.isLoading || chargerQuery.isLoading,
    refetch: () => {
      bookingQuery.refetch();
      chargerQuery.refetch();
    },
  };
}
