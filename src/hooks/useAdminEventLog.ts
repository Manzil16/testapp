import { useCallback, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  searchPlatformEvents,
  getPlatformStats,
  type AdminEventFilter,
  type PlatformEvent,
  type PlatformStats,
} from "@/src/features/admin/admin.repository";

export function useAdminEventLog() {
  const [filter, setFilterState] = useState<AdminEventFilter>({
    page: 0,
    pageSize: 50,
  });

  const eventsQuery = useQuery({
    queryKey: ["admin-events", filter],
    queryFn: () => searchPlatformEvents(filter),
    staleTime: 30_000,
  });

  const statsQuery = useQuery({
    queryKey: ["admin-stats"],
    queryFn: getPlatformStats,
    refetchInterval: 60_000,
  });

  const setFilter = useCallback(
    (patch: Partial<AdminEventFilter>) => {
      setFilterState((prev) => ({ ...prev, ...patch, page: 0 }));
    },
    []
  );

  const loadMore = useCallback(() => {
    setFilterState((prev) => ({
      ...prev,
      page: (prev.page ?? 0) + 1,
    }));
  }, []);

  return {
    events: eventsQuery.data?.events ?? ([] as PlatformEvent[]),
    total: eventsQuery.data?.total ?? 0,
    stats: statsQuery.data as PlatformStats | undefined,
    isLoading: eventsQuery.isLoading,
    isFetching: eventsQuery.isFetching,
    filter,
    setFilter,
    loadMore,
    refetch: () => {
      eventsQuery.refetch();
      statsQuery.refetch();
    },
  };
}
