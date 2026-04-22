import { useCallback, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — @mapbox/polyline ships as CJS without types
import polyline from "@mapbox/polyline";
import { listChargers } from "../features/chargers/charger.repository";
import { createTrip, listTripsByUser } from "../features/trips/trip.repository";
import { listVehiclesByUser } from "../features/vehicles/vehicle.repository";
import { searchAddress, type GeoResult } from "../services/geocodingService";
import { getRoute } from "../services/routingService";
import { useDebounce } from "./useDebounce";
import { rankChargersAlongRoute, type RouteCandidate } from "../utils/chargerRecommender";
import type { Charger } from "../features/chargers/charger.types";

type RoutePoint = { latitude: number; longitude: number };

export interface RouteChargerSuggestion {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  pricingPerKwh: number;
  maxPowerKw: number;
  detourKm: number;
  score: number;
  connectorTypes: string[];
}

interface TripPlannerSummary {
  distanceKm: number;
  durationMinutes: number;
  projectedArrivalPercent: number;
  polyline: string;
  routePoints: RoutePoint[];
  needsCharge: boolean;
  suggestedChargers: RouteChargerSuggestion[];
  /** First suggestion, kept for back-compat with older screens. */
  recommendedCharger: RouteChargerSuggestion | null;
}

function decodeRoutePolyline(encoded: string): RoutePoint[] {
  if (!encoded) return [];
  try {
    const pairs = polyline.decode(encoded) as [number, number][];
    return pairs.map(([latitude, longitude]) => ({ latitude, longitude }));
  } catch {
    return [];
  }
}

/**
 * Sample a polyline down to ~N points to keep corridor distance checks fast.
 */
function samplePolyline(points: RoutePoint[], targetSamples = 80): RoutePoint[] {
  if (points.length <= targetSamples) return points;
  const stride = Math.ceil(points.length / targetSamples);
  const sampled: RoutePoint[] = [];
  for (let i = 0; i < points.length; i += stride) sampled.push(points[i]);
  // Always include the final point so the corridor reaches the destination.
  if (sampled[sampled.length - 1] !== points[points.length - 1]) {
    sampled.push(points[points.length - 1]);
  }
  return sampled;
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
    retry: 1,
  });

  const destSearchQuery = useQuery({
    queryKey: ["geocode", debouncedDest],
    queryFn: () => searchAddress(debouncedDest),
    enabled: debouncedDest.length >= 3 && !destination,
    retry: 1,
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

      // Decode the actual route geometry so the corridor filter follows the road,
      // not a straight line between origin and destination.
      const decoded = decodeRoutePolyline(route.polyline);
      const routePoints: RoutePoint[] = decoded.length >= 2
        ? samplePolyline(decoded)
        : [
            { latitude: origin.latitude, longitude: origin.longitude },
            { latitude: destination.latitude, longitude: destination.longitude },
          ];

      // Rank every charger within 5 km of the route, filtered by vehicle connector.
      const allChargers: Charger[] = chargersQuery.data ?? [];
      const candidates: RouteCandidate<Charger>[] = rankChargersAlongRoute(
        allChargers,
        routePoints,
        {
          maxDetourKm: 5,
          connectorType: primaryVehicle?.connectorType,
        },
      );

      const suggestedChargers: RouteChargerSuggestion[] = candidates.map((c) => ({
        id: c.charger.id,
        name: c.charger.name,
        address: c.charger.address,
        latitude: c.charger.latitude,
        longitude: c.charger.longitude,
        pricingPerKwh: c.charger.pricingPerKwh,
        maxPowerKw: c.charger.maxPowerKw,
        detourKm: c.detourKm,
        score: c.score,
        connectorTypes: c.charger.connectors?.map((cn) => cn.type) ?? [],
      }));

      const result: TripPlannerSummary = {
        distanceKm: route.distanceKm,
        durationMinutes: route.durationMinutes,
        projectedArrivalPercent: Math.round(projectedArrival * 10) / 10,
        polyline: route.polyline,
        routePoints,
        needsCharge,
        suggestedChargers,
        recommendedCharger: suggestedChargers[0] ?? null,
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
        recommendedChargerId: result.recommendedCharger?.id,
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
  }, [origin, destination, userId, batteryPercent, vehicleRangeKm, chargersQuery.data, preferredReservePercent, primaryVehicle?.connectorType, queryClient]);

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
      originSearchError: originSearchQuery.error
        ? (originSearchQuery.error as Error).message
        : null,
      destinationSearchError: destSearchQuery.error
        ? (destSearchQuery.error as Error).message
        : null,
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
