import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { listChargers } from "../features/chargers/charger.repository";
import type { Charger, ConnectorType } from "../features/chargers/charger.types";
import { useDebounce } from "./useDebounce";

type MinPowerFilter = "any" | "7" | "22" | "50";
const PAGE_SIZE = 10;

export function useChargerDiscovery() {
  const [viewMode, setViewMode] = useState<"map" | "list">("list");
  const [searchText, setSearchText] = useState("");
  const [connectorFilter, setConnectorFilter] = useState<ConnectorType | "any">("any");
  const [minPowerFilter, setMinPowerFilter] = useState<MinPowerFilter>("any");
  const [page, setPage] = useState(1);

  const debouncedSearch = useDebounce(searchText, 300);

  const chargersQuery = useQuery({
    queryKey: ["chargers", "discovery"],
    queryFn: () => listChargers({ status: "approved" }),
  });

  const all = useMemo(() => chargersQuery.data ?? [], [chargersQuery.data]);

  const filtered = useMemo(() => {
    return all.filter((c: Charger) => {
      if (debouncedSearch) {
        const hay = `${c.name} ${c.address} ${c.suburb}`.toLowerCase();
        if (!hay.includes(debouncedSearch.trim().toLowerCase())) return false;
      }
      if (connectorFilter !== "any" && !c.connectors.some((cn) => cn.type === connectorFilter))
        return false;
      if (minPowerFilter !== "any" && c.maxPowerKw < Number(minPowerFilter)) return false;
      return true;
    });
  }, [all, debouncedSearch, connectorFilter, minPowerFilter]);

  const chargers = filtered.slice(0, page * PAGE_SIZE);
  const hasMore = chargers.length < filtered.length;

  return {
    data: {
      chargers,
      total: filtered.length,
      all: filtered,
      viewMode,
      searchText,
      connectorFilter,
      minPowerFilter,
      hasMore,
    },
    isLoading: chargersQuery.isLoading,
    error: chargersQuery.error?.message || null,
    refresh: async () => {
      setPage(1);
      await chargersQuery.refetch();
    },
    actions: {
      setViewMode,
      setSearchText: (text: string) => {
        setSearchText(text);
        setPage(1);
      },
      setConnectorFilter: (filter: ConnectorType | "any") => {
        setConnectorFilter(filter);
        setPage(1);
      },
      setMinPowerFilter: (filter: MinPowerFilter) => {
        setMinPowerFilter(filter);
        setPage(1);
      },
      loadMore: () => setPage((p) => p + 1),
    },
  };
}
