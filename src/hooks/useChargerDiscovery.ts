import { useCallback, useEffect, useMemo, useState } from "react";
import {
  listChargers,
  listenToChargers,
  type Charger,
  type ConnectorType,
} from "@/src/features/chargers";

export type DiscoveryViewMode = "map" | "list";
export type MinPowerFilter = "any" | "7" | "22" | "50";

const PAGE_SIZE = 12;

export function useChargerDiscovery() {
  const [chargers, setChargers] = useState<Charger[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchText, setSearchText] = useState("");
  const [connectorFilter, setConnectorFilter] = useState<ConnectorType | "any">("any");
  const [minPowerFilter, setMinPowerFilter] = useState<MinPowerFilter>("any");
  const [viewMode, setViewMode] = useState<DiscoveryViewMode>("map");
  const [page, setPage] = useState(1);

  useEffect(() => {
    setIsLoading(true);
    setError(null);
    const unsubscribe = listenToChargers(
      (items) => {
        setChargers(items.filter((item) => item.status === "verified"));
        setIsLoading(false);
      },
      undefined,
      (message) => {
        setError(message);
        setIsLoading(false);
      }
    );

    return unsubscribe;
  }, []);

  const filtered = useMemo(() => {
    const minPower = minPowerFilter === "any" ? 0 : Number(minPowerFilter);
    const normalizedSearch = searchText.trim().toLowerCase();

    return chargers.filter((item) => {
      if (normalizedSearch) {
        const haystack = `${item.name} ${item.suburb} ${item.address}`.toLowerCase();
        if (!haystack.includes(normalizedSearch)) {
          return false;
        }
      }

      if (connectorFilter !== "any") {
        const matchesConnector = item.connectors.some((connector) => connector.type === connectorFilter);
        if (!matchesConnector) {
          return false;
        }
      }

      if (minPower > 0 && item.maxPowerKw < minPower) {
        return false;
      }

      return true;
    });
  }, [chargers, connectorFilter, minPowerFilter, searchText]);

  useEffect(() => {
    setPage(1);
  }, [searchText, connectorFilter, minPowerFilter]);

  const paged = useMemo(() => filtered.slice(0, page * PAGE_SIZE), [filtered, page]);

  const hasMore = paged.length < filtered.length;

  const loadMore = useCallback(() => {
    if (hasMore) {
      setPage((current) => current + 1);
    }
  }, [hasMore]);

  const refresh = useCallback(async () => {
    try {
      setError(null);
      const result = await listChargers();
      setChargers(result.filter((item) => item.status === "verified"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to refresh chargers.");
    }
  }, []);

  return {
    data: {
      chargers: paged,
      total: filtered.length,
      all: filtered,
      viewMode,
      searchText,
      connectorFilter,
      minPowerFilter,
      hasMore,
    },
    isLoading,
    error,
    refresh,
    actions: {
      setViewMode,
      setSearchText,
      setConnectorFilter,
      setMinPowerFilter,
      loadMore,
    },
  };
}
