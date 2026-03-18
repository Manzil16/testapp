import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { listBookingsByDriver } from "../features/bookings/booking.repository";
import { listChargers } from "../features/chargers/charger.repository";
import { listTripsByUser } from "../features/trips/trip.repository";
import { listVehiclesByUser } from "../features/vehicles/vehicle.repository";
import { useUserLocation, getDistanceKm } from "./useUserLocation";
import type { Booking } from "../features/bookings/booking.types";
import type { Charger } from "../features/chargers/charger.types";

export interface ChargerWithDistance extends Charger {
  distanceKm: number | null;
}

export function useDriverDashboard(userId?: string) {
  const { location } = useUserLocation();

  const bookingsQuery = useQuery({
    queryKey: ["bookings", "driver", userId],
    queryFn: () => listBookingsByDriver(userId!),
    enabled: Boolean(userId),
  });

  const chargersQuery = useQuery({
    queryKey: ["chargers", "approved"],
    queryFn: () => listChargers({ status: "approved" }),
    enabled: Boolean(userId),
  });

  const tripsQuery = useQuery({
    queryKey: ["trips", userId],
    queryFn: () => listTripsByUser(userId!),
    enabled: Boolean(userId),
  });

  const vehiclesQuery = useQuery({
    queryKey: ["vehicles", userId],
    queryFn: () => listVehiclesByUser(userId!),
    enabled: Boolean(userId),
  });

  const bookings = useMemo(() => bookingsQuery.data ?? [], [bookingsQuery.data]);
  const chargers = useMemo(() => chargersQuery.data ?? [], [chargersQuery.data]);
  const trips = useMemo(() => tripsQuery.data ?? [], [tripsQuery.data]);
  const vehicles = useMemo(() => vehiclesQuery.data ?? [], [vehiclesQuery.data]);

  const activeBooking = useMemo(
    () =>
      bookings.find(
        (b: Booking) => b.status === "approved" || b.status === "in_progress"
      ) ?? null,
    [bookings]
  );

  const chargersById = useMemo(() => {
    const map: Record<string, Charger> = {};
    for (const c of chargers) map[c.id] = c;
    return map;
  }, [chargers]);

  // Sort chargers by distance from user, return top 6
  const nearbyChargers = useMemo<ChargerWithDistance[]>(() => {
    const withDistance: ChargerWithDistance[] = chargers.map((c) => ({
      ...c,
      distanceKm: location
        ? getDistanceKm(location.latitude, location.longitude, c.latitude, c.longitude)
        : null,
    }));

    withDistance.sort((a, b) => {
      if (a.distanceKm === null && b.distanceKm === null) return 0;
      if (a.distanceKm === null) return 1;
      if (b.distanceKm === null) return -1;
      return a.distanceKm - b.distanceKm;
    });

    return withDistance.slice(0, 6);
  }, [chargers, location]);

  // The single nearest charger for quick CTA
  const nearestCharger = nearbyChargers[0] ?? null;

  return {
    data: {
      activeBooking,
      nearbyChargers,
      nearestCharger,
      chargersById,
      stats: {
        totalBookings: bookings.length,
        totalTrips: trips.length,
        vehiclesRegistered: vehicles.length,
      },
      bookings,
      trips,
      vehicles,
    },
    isLoading: bookingsQuery.isLoading || chargersQuery.isLoading,
    error: bookingsQuery.error?.message || chargersQuery.error?.message || null,
    refresh: async () => {
      await Promise.all([
        bookingsQuery.refetch(),
        chargersQuery.refetch(),
        tripsQuery.refetch(),
        vehiclesQuery.refetch(),
      ]);
    },
  };
}
