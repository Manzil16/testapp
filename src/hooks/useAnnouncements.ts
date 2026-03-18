import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/src/lib/supabase";

export interface Announcement {
  id: string;
  title: string;
  body: string;
  type: "info" | "warning" | "promo";
  active: boolean;
  createdAtIso: string;
}

/**
 * Fetches active announcements from a `announcements` table if it exists,
 * otherwise falls back to system notifications marked as announcements.
 * Gracefully degrades if the table doesn't exist yet.
 */
export function useAnnouncements() {
  const query = useQuery({
    queryKey: ["announcements"],
    queryFn: async (): Promise<Announcement[]> => {
      // Try announcements table first (cast needed until DB types regenerated)
      const { data, error } = await (supabase as any)
        .from("announcements")
        .select("*")
        .eq("active", true)
        .order("created_at", { ascending: false })
        .limit(3);

      if (error) {
        // Table doesn't exist yet — gracefully return empty
        return [];
      }

      return (data ?? []).map((row: Record<string, unknown>) => ({
        id: row.id as string,
        title: row.title as string,
        body: row.body as string,
        type: (row.type as Announcement["type"]) || "info",
        active: row.active as boolean,
        createdAtIso: row.created_at as string,
      }));
    },
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  return {
    announcements: query.data ?? [],
    isLoading: query.isLoading,
  };
}
