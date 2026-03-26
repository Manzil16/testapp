import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/src/lib/supabase";

interface ChargerStats {
  avgRating: number;
  totalSessions: number;
  avgSessionMinutes: number;
}

export function useChargerStats(chargerId: string) {
  return useQuery<ChargerStats>({
    queryKey: ["charger-stats", chargerId],
    queryFn: async () => {
      // Average rating from reviews
      const { data: reviews } = await supabase
        .from("reviews")
        .select("rating")
        .eq("charger_id", chargerId);

      const ratings = (reviews ?? []).map((r) => Number(r.rating));
      const avgRating =
        ratings.length > 0
          ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10
          : 0;

      // Total completed sessions
      const { count: totalSessions } = await supabase
        .from("bookings")
        .select("id", { count: "exact", head: true })
        .eq("charger_id", chargerId)
        .eq("status", "completed");

      // Average session duration
      const { data: sessions } = await supabase
        .from("bookings")
        .select("session_started_at, session_ended_at")
        .eq("charger_id", chargerId)
        .eq("status", "completed")
        .not("session_started_at", "is", null)
        .not("session_ended_at", "is", null);

      let avgSessionMinutes = 0;
      if (sessions && sessions.length > 0) {
        const durations = sessions.map((s) => {
          const start = new Date(s.session_started_at).getTime();
          const end = new Date(s.session_ended_at).getTime();
          return (end - start) / (1000 * 60);
        });
        avgSessionMinutes = Math.round(
          durations.reduce((a, b) => a + b, 0) / durations.length
        );
      }

      return {
        avgRating,
        totalSessions: totalSessions ?? 0,
        avgSessionMinutes,
      };
    },
    enabled: !!chargerId,
  });
}
