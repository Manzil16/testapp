import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { listChargers } from "../features/chargers/charger.repository";
import { listAllBookings } from "../features/bookings/booking.repository";
import { supabase } from "../lib/supabase";
import type { Charger, ChargerStatus } from "../features/chargers/charger.types";
import type { Booking, BookingStatus } from "../features/bookings/booking.types";

type ProfileLite = { displayName: string; avatarUrl?: string };

/**
 * Fetches chargers + full context (host names, for admin display).
 * Status filter narrows to a single status; "all" returns everything.
 */
export function useAdminChargers(statusFilter: ChargerStatus | "all") {
  const chargersQuery = useQuery({
    queryKey: ["admin-chargers", statusFilter],
    queryFn: () =>
      listChargers(statusFilter === "all" ? undefined : { status: statusFilter }),
    staleTime: 30_000,
  });

  const hostIds = useMemo(
    () => [...new Set((chargersQuery.data ?? []).map((c) => c.hostUserId))],
    [chargersQuery.data],
  );

  const hostsQuery = useQuery({
    queryKey: ["admin-chargers", "hosts", hostIds],
    queryFn: async () => {
      if (!hostIds.length) return {} as Record<string, ProfileLite>;
      const { data } = await supabase
        .from("profiles")
        .select("id, display_name, avatar_url")
        .in("id", hostIds);
      const map: Record<string, ProfileLite> = {};
      for (const row of data ?? []) {
        map[row.id as string] = {
          displayName: (row.display_name as string) ?? `Host ${(row.id as string).slice(0, 6)}`,
          avatarUrl: (row.avatar_url as string | null) ?? undefined,
        };
      }
      return map;
    },
    enabled: hostIds.length > 0,
  });

  return {
    chargers: chargersQuery.data ?? ([] as Charger[]),
    hostsById: hostsQuery.data ?? {},
    isLoading: chargersQuery.isLoading,
    error: chargersQuery.error?.message ?? null,
    refetch: chargersQuery.refetch,
  };
}

/**
 * Fetches bookings with driver + host + charger names joined client-side.
 * Status filter narrows to a single status; "all" returns everything.
 */
export function useAdminBookings(statusFilter: BookingStatus | "all") {
  const bookingsQuery = useQuery({
    queryKey: ["admin-bookings"],
    queryFn: listAllBookings,
    staleTime: 30_000,
  });

  const filtered = useMemo(() => {
    const raw = bookingsQuery.data ?? [];
    if (statusFilter === "all") return raw;
    return raw.filter((b) => b.status === statusFilter);
  }, [bookingsQuery.data, statusFilter]);

  const userIds = useMemo(() => {
    const set = new Set<string>();
    for (const b of bookingsQuery.data ?? []) {
      if (b.driverUserId) set.add(b.driverUserId);
      if (b.hostUserId) set.add(b.hostUserId);
    }
    return [...set];
  }, [bookingsQuery.data]);

  const chargerIds = useMemo(
    () => [...new Set((bookingsQuery.data ?? []).map((b) => b.chargerId))],
    [bookingsQuery.data],
  );

  const profilesQuery = useQuery({
    queryKey: ["admin-bookings", "profiles", userIds],
    queryFn: async () => {
      if (!userIds.length) return {} as Record<string, ProfileLite>;
      const { data } = await supabase
        .from("profiles")
        .select("id, display_name, avatar_url")
        .in("id", userIds);
      const map: Record<string, ProfileLite> = {};
      for (const row of data ?? []) {
        map[row.id as string] = {
          displayName: (row.display_name as string) ?? `User ${(row.id as string).slice(0, 6)}`,
          avatarUrl: (row.avatar_url as string | null) ?? undefined,
        };
      }
      return map;
    },
    enabled: userIds.length > 0,
  });

  const chargersQuery = useQuery({
    queryKey: ["admin-bookings", "chargers", chargerIds],
    queryFn: async () => {
      if (!chargerIds.length) return {} as Record<string, { name: string; suburb: string }>;
      const { data } = await supabase
        .from("chargers")
        .select("id, name, suburb")
        .in("id", chargerIds);
      const map: Record<string, { name: string; suburb: string }> = {};
      for (const row of data ?? []) {
        map[row.id as string] = {
          name: (row.name as string) ?? "Charger",
          suburb: (row.suburb as string) ?? "",
        };
      }
      return map;
    },
    enabled: chargerIds.length > 0,
  });

  return {
    bookings: filtered as Booking[],
    totalAll: bookingsQuery.data?.length ?? 0,
    profilesById: profilesQuery.data ?? {},
    chargersById: chargersQuery.data ?? {},
    isLoading: bookingsQuery.isLoading,
    error: bookingsQuery.error?.message ?? null,
    refetch: bookingsQuery.refetch,
  };
}
