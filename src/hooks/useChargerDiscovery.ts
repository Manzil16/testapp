import { useState, useMemo, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { listChargers } from "../features/chargers/charger.repository";
import { fetchOcmChargers } from "../services/openChargeMapService";
import type { Charger, ConnectorType } from "../features/chargers/charger.types";
import { useDebounce } from "./useDebounce";
import { useUserLocation, getDistanceKm } from "./useUserLocation";
import { AppConfig } from "../constants/app";

type MinPowerFilter = "any" | "7" | "22" | "50";
const PAGE_SIZE = 10;

/**
 * How far the user must move (km) before we fire another OCM request.
 * Keeps us well within the 5 000 req/day free tier.
 */
const OCM_REFETCH_THRESHOLD_KM = 5;

/** Snap a lat/lng to a coarse grid so nearby positions share the same cache key */
function snapToGrid(value: number, step = 0.05): number {
  return Math.round(value / step) * step;
}

export function useChargerDiscovery() {
  const [viewMode, setViewMode] = useState<"map" | "list">("list");
  const [searchText, setSearchText] = useState("");
  const [connectorFilter, setConnectorFilter] = useState<ConnectorType | "any">("any");
  const [minPowerFilter, setMinPowerFilter] = useState<MinPowerFilter>("any");
  const [page, setPage] = useState(1);

  const debouncedSearch = useDebounce(searchText, 300);
  const { location } = useUserLocation();

  // Track the last location we fired an OCM query for, so we can apply the
  // 5 km threshold and avoid burning through the daily rate limit.
  const lastOcmLocationRef = useRef<{ lat: number; lng: number } | null>(null);

  // Resolve the query origin: use real location, or fall back to Sydney default.
  const queryLat = location?.latitude  ?? AppConfig.DEFAULT_REGION.latitude;
  const queryLng = location?.longitude ?? AppConfig.DEFAULT_REGION.longitude;

  // Snap coords to a grid so minor GPS jitter doesn't bust the cache.
  const gridLat = snapToGrid(queryLat);
  const gridLng = snapToGrid(queryLng);

  // ── Supabase chargers (the platform's own listings) ──────────────────────
  const supabaseQuery = useQuery({
    queryKey: ["chargers", "discovery"],
    queryFn:  () => listChargers({ status: "approved" }),
  });

  // ── Open Charge Map chargers ──────────────────────────────────────────────
  const ocmQuery = useQuery({
    queryKey: ["chargers", "ocm", gridLat, gridLng],
    queryFn:  async () => {
      // Use grid-snapped coords so the API call matches the cache key. This
      // means nearby moves within the same grid cell reuse the cached result
      // without re-fetching with slightly different raw GPS coordinates.
      const result = await fetchOcmChargers({ latitude: gridLat, longitude: gridLng });
      lastOcmLocationRef.current = { lat: gridLat, lng: gridLng };
      return result;
    },
    // Cache for 5 minutes — public station data doesn't change frequently
    staleTime: 5 * 60 * 1000,
    // Keep previous data while refetching so the map doesn't flicker
    placeholderData: (prev) => prev,
    // Only fire if we've moved more than the threshold from the last query
    // (or if this is the very first query).
    enabled: (() => {
      const last = lastOcmLocationRef.current;
      if (!last) return true;
      try {
        return getDistanceKm(last.lat, last.lng, queryLat, queryLng) >= OCM_REFETCH_THRESHOLD_KM;
      } catch {
        // If distance calc fails (invalid coords), allow the query to run
        return true;
      }
    })(),
  });

  // ── Merge Supabase + OCM results ──────────────────────────────────────────
  // Supabase chargers take priority: if an OCM ID somehow matched a Supabase
  // charger we'd deduplicate it here. In practice they have different ID
  // namespaces ("ocm-" prefix vs UUID) so no collision is expected.
  const all = useMemo<Charger[]>(() => {
    const supabase = supabaseQuery.data ?? [];
    const ocm      = ocmQuery.data      ?? [];
    const supabaseIds = new Set(supabase.map((c) => c.id));
    const uniqueOcm   = ocm.filter((c) => !supabaseIds.has(c.id));
    return [...supabase, ...uniqueOcm];
  }, [supabaseQuery.data, ocmQuery.data]);

  // ── Client-side filtering ─────────────────────────────────────────────────
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
  const hasMore  = chargers.length < filtered.length;

  const isLoading = supabaseQuery.isLoading || ocmQuery.isLoading;
  const error     = supabaseQuery.error?.message || ocmQuery.error?.message || null;

  return {
    data: {
      chargers,
      total: filtered.length,
      all:   filtered,
      viewMode,
      searchText,
      connectorFilter,
      minPowerFilter,
      hasMore,
    },
    isLoading,
    error,
    refresh: async () => {
      setPage(1);
      await Promise.all([supabaseQuery.refetch(), ocmQuery.refetch()]);
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
