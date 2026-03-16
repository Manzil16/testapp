import { useCallback, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { listChargers } from "../features/chargers/charger.repository";
import { createTrip, listTripsByUser } from "../features/trips/trip.repository";
import { listVehiclesByUser } from "../features/vehicles/vehicle.repository";
import { searchAddress, type GeoResult } from "../services/geocodingService";
import { getRoute } from "../services/routingService";
import { useDebounce } from "./useDebounce";

interface TripPlannerSummary {
  distanceKm: number;
  durationMinutes: number;
  projectedArrivalPercent: number;
  polyline: string;
  needsCharge: boolean;
  recommendedCharger: { id: string; name: string; address: string } | null;
}

export function useTripPlanner(userId?: string, preferredReservePercent = 12) {
  const queryClient = useQueryClient();

  const [originQuery, setOriginQuery] = useState("");
  const [destinationQuery, setDestinationQuery] = useState("");
  const [origin, setOrigin] = useState<GeoResult | null>(null);
  const [destination, setDestination] = useState<GeoResult | null>(null);
  const [batteryPercent, setBatteryPercent] = useState("80");
  const [vehicleRangeKm, setVehicleRangeKm] = useState("400");
  const [summary, setSummary] = useState<TripPlannerSummary | null>(null);
  const [isPlanning, setIsPlanning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const debouncedOrigin = useDebounce(originQuery, 400);
  const debouncedDest = useDebounce(destinationQuery, 400);

  const vehiclesQuery = useQuery({
    queryKey: ["vehicles", userId],
    queryFn: () => listVehiclesByUser(userId!),
    enabled: Boolean(userId),
  });

  const tripsQuery = useQuery({
    queryKey: ["trips", userId],
    queryFn: () => listTripsByUser(userId!),
    enabled: Boolean(userId),
  });

  const chargersQuery = useQuery({
    queryKey: ["chargers", "approved"],
    queryFn: () => listChargers({ status: "approved" }),
  });

  const originSearchQuery = useQuery({
    queryKey: ["geocode", debouncedOrigin],
    queryFn: () => searchAddress(debouncedOrigin),
    enabled: debouncedOrigin.length >= 3 && !origin,
  });

  const destSearchQuery = useQuery({
    queryKey: ["geocode", debouncedDest],
    queryFn: () => searchAddress(debouncedDest),
    enabled: debouncedDest.length >= 3 && !destination,
  });

  const vehicles = vehiclesQuery.data ?? [];
  const primaryVehicle = vehicles[0] ?? null;

  const planTrip = useCallback(async () => {
    if (!origin || !destination || !userId) {
      throw new Error("Select origin and destination");
    }

    setIsPlanning(true);
    setError(null);

    try {
      const route = await getRoute(
        { latitude: origin.latitude, longitude: origin.longitude },
        { latitude: destination.latitude, longitude: destination.longitude }
      );

      const battery = Number(batteryPercent) || 80;
      const range = Number(vehicleRangeKm) || 400;
      const energyUsed = (route.distanceKm / range) * 100;
      const projectedArrival = Math.max(0, battery - energyUsed);
      const needsCharge = projectedArrival < preferredReservePercent;

      let recommendedCharger = null;
      if (needsCharge) {
        const chargers = chargersQuery.data ?? [];
        if (chargers.length > 0) {
          const first = chargers[0];
          recommendedCharger = { id: first.id, name: first.name, address: first.address };
        }
      }

      const result: TripPlannerSummary = {
        distanceKm: route.distanceKm,
        durationMinutes: route.durationMinutes,
        projectedArrivalPercent: Math.round(projectedArrival * 10) / 10,
        polyline: route.polyline,
        needsCharge,
        recommendedCharger,
      };

      setSummary(result);

      await createTrip({
        userId,
        origin: { label: origin.displayName, latitude: origin.latitude, longitude: origin.longitude },
        destination: { label: destination.displayName, latitude: destination.latitude, longitude: destination.longitude },
        currentBatteryPercent: battery,
        vehicleMaxRangeKm: range,
        distanceKm: route.distanceKm,
        durationMinutes: route.durationMinutes,
        routePolyline: route.polyline,
        projectedArrivalPercent: result.projectedArrivalPercent,
        recommendedChargerId: recommendedCharger?.id,
      });

      queryClient.invalidateQueries({ queryKey: ["trips", userId] });
      return result;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Trip planning failed";
      setError(msg);
      throw err;
    } finally {
      setIsPlanning(false);
    }
  }, [origin, destination, userId, batteryPercent, vehicleRangeKm, chargersQuery.data, preferredReservePercent, queryClient]);

  return {
    data: {
      vehicles,
      primaryVehicle,
      savedTrips: tripsQuery.data ?? [],
      originQuery,
      destinationQuery,
      originResults: originSearchQuery.data ?? [],
      destinationResults: destSearchQuery.data ?? [],
      origin,
      destination,
      batteryPercent,
      vehicleRangeKm,
      summary,
      isOriginSearching: originSearchQuery.isLoading,
      isDestinationSearching: destSearchQuery.isLoading,
    },
    isLoading: vehiclesQuery.isLoading,
    isPlanning,
    error,
    refresh: async () => {
      await Promise.all([vehiclesQuery.refetch(), tripsQuery.refetch()]);
    },
    actions: {
      setOriginQuery: (value: string) => {
        setOriginQuery(value);
        setOrigin(null);
      },
      setDestinationQuery: (value: string) => {
        setDestinationQuery(value);
        setDestination(null);
      },
      selectOrigin: (result: GeoResult) => {
        setOrigin(result);
        setOriginQuery(result.displayName);
      },
      selectDestination: (result: GeoResult) => {
        setDestination(result);
        setDestinationQuery(result.displayName);
      },
      setBatteryPercent,
      setVehicleRangeKm,
      planTrip,
      clearSummary: () => setSummary(null),
    },
  };
}
