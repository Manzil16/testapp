import { useCallback, useMemo } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useQuery, useQueryClient } from "@tanstack/react-query";

const WISHLIST_KEY = "charger_wishlist";

export function useWishlist() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["wishlist"],
    queryFn: async (): Promise<string[]> => {
      const raw = await AsyncStorage.getItem(WISHLIST_KEY);
      return raw ? JSON.parse(raw) : [];
    },
    staleTime: Infinity,
  });

  const savedIds = useMemo(() => new Set(query.data ?? []), [query.data]);

  const toggleSaved = useCallback(
    async (chargerId: string) => {
      const current = query.data ?? [];
      let next: string[];
      if (current.includes(chargerId)) {
        next = current.filter((id) => id !== chargerId);
      } else {
        next = [chargerId, ...current];
      }
      await AsyncStorage.setItem(WISHLIST_KEY, JSON.stringify(next));
      queryClient.setQueryData(["wishlist"], next);
    },
    [query.data, queryClient]
  );

  const isSaved = useCallback(
    (chargerId: string) => savedIds.has(chargerId),
    [savedIds]
  );

  return {
    savedIds,
    savedCount: savedIds.size,
    isSaved,
    toggleSaved,
  };
}
