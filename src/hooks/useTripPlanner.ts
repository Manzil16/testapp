import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { type Charger, listChargers } from "@/src/features/chargers";
import { createTrip, listenToTripsByUser, type Trip } from "@/src/features/trips";
import { listenToVehiclesByUser, type Vehicle } from "@/src/features/vehicles";
import { searchAddress, type GeoResult } from "@/src/services/geocodingService";
import { getRouteData } from "@/src/services/routingService";
import { useDebounce } from "@/src/hooks/useDebounce";

interface TripPlannerSummary {
  distanceKm: number;
  durationMinutes: number;
  projectedArrivalPercent: number;
  consumedPercent: number;
  directFeasible: boolean;
  recommendedChargers: Charger[];
  routePolyline: string;
}

function haversineKm(
  fromLat: number,
  fromLng: number,
  toLat: number,
  toLng: number
): number {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const dLat = toRad(toLat - fromLat);
  const dLng = toRad(toLng - fromLng);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(fromLat)) * Math.cos(toRad(toLat)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function useTripPlanner(userId?: string, preferredReservePercent?: number) {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [savedTrips, setSavedTrips] = useState<Trip[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [originQuery, setOriginQuery] = useState("");
  const [destinationQuery, setDestinationQuery] = useState("");
  const [originResults, setOriginResults] = useState<GeoResult[]>([]);
  const [destinationResults, setDestinationResults] = useState<GeoResult[]>([]);
  const [origin, setOrigin] = useState<GeoResult | null>(null);
  const [destination, setDestination] = useState<GeoResult | null>(null);
  const [originLocked, setOriginLocked] = useState(false);
  const [destinationLocked, setDestinationLocked] = useState(false);

  const [batteryPercent, setBatteryPercent] = useState("65");
  const [vehicleRangeKm, setVehicleRangeKm] = useState("420");
  const [planning, setPlanning] = useState(false);
  const [summary, setSummary] = useState<TripPlannerSummary | null>(null);

  const [isOriginSearching, setIsOriginSearching] = useState(false);
  const [isDestinationSearching, setIsDestinationSearching] = useState(false);

  const debouncedOriginQuery = useDebounce(originQuery, 300);
  const debouncedDestinationQuery = useDebounce(destinationQuery, 300);

  const originReqId = useRef(0);
  const destinationReqId = useRef(0);

  useEffect(() => {
    if (!userId) {
      setVehicles([]);
      setSavedTrips([]);
      setError(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    let tripsReady = false;
    let vehiclesReady = false;

    const markReady = () => {
      if (tripsReady && vehiclesReady) {
        setIsLoading(false);
      }
    };

    const unsubVehicles = listenToVehiclesByUser(
      userId,
      (items) => {
        setVehicles(items);
        if (items[0]) {
          setVehicleRangeKm(String(items[0].maxRangeKm));
        }
        vehiclesReady = true;
        markReady();
      },
      (message) => {
        setError(message);
        vehiclesReady = true;
        markReady();
      }
    );

    const unsubTrips = listenToTripsByUser(
      userId,
      (items) => {
        setSavedTrips(items);
        tripsReady = true;
        markReady();
      },
      (message) => {
        setError(message);
        tripsReady = true;
        markReady();
      }
    );

    return () => {
      unsubVehicles();
      unsubTrips();
    };
  }, [userId]);

  useEffect(() => {
    const primaryVehicle = vehicles[0];
    if (!primaryVehicle) {
      return;
    }

    setBatteryPercent(String(100 - (preferredReservePercent ?? primaryVehicle.defaultReservePercent ?? 12)));
  }, [preferredReservePercent, vehicles]);

  useEffect(() => {
    if (!debouncedOriginQuery || debouncedOriginQuery.length < 3) {
      setOriginResults([]);
      return;
    }

    if (originLocked && origin && debouncedOriginQuery === origin.displayName) {
      setOriginResults([]);
      setIsOriginSearching(false);
      return;
    }

    originReqId.current += 1;
    const nextReq = originReqId.current;
    setIsOriginSearching(true);

    searchAddress(debouncedOriginQuery)
      .then((results) => {
        if (nextReq === originReqId.current) {
          setOriginResults(results);
        }
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Unable to search origin.");
      })
      .finally(() => {
        if (nextReq === originReqId.current) {
          setIsOriginSearching(false);
        }
      });
  }, [debouncedOriginQuery, origin, originLocked]);

  useEffect(() => {
    if (!debouncedDestinationQuery || debouncedDestinationQuery.length < 3) {
      setDestinationResults([]);
      return;
    }

    if (
      destinationLocked &&
      destination &&
      debouncedDestinationQuery === destination.displayName
    ) {
      setDestinationResults([]);
      setIsDestinationSearching(false);
      return;
    }

    destinationReqId.current += 1;
    const nextReq = destinationReqId.current;
    setIsDestinationSearching(true);

    searchAddress(debouncedDestinationQuery)
      .then((results) => {
        if (nextReq === destinationReqId.current) {
          setDestinationResults(results);
        }
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Unable to search destination.");
      })
      .finally(() => {
        if (nextReq === destinationReqId.current) {
          setIsDestinationSearching(false);
        }
      });
  }, [debouncedDestinationQuery, destination, destinationLocked]);

  const refresh = useCallback(async () => {
    // Firestore listeners keep this hook synced; explicit refresh is a no-op for API parity.
    return;
  }, []);

  const updateOriginQuery = useCallback((value: string) => {
    setOriginQuery(value);
    setOriginLocked(false);
    if (origin && value !== origin.displayName) {
      setOrigin(null);
    }
    setSummary(null);
  }, [origin]);

  const updateDestinationQuery = useCallback((value: string) => {
    setDestinationQuery(value);
    setDestinationLocked(false);
    if (destination && value !== destination.displayName) {
      setDestination(null);
    }
    setSummary(null);
  }, [destination]);

  const selectOrigin = useCallback((result: GeoResult) => {
    setOrigin(result);
    setOriginQuery(result.displayName);
    setOriginLocked(true);
    setOriginResults([]);
    setSummary(null);
  }, []);

  const selectDestination = useCallback((result: GeoResult) => {
    setDestination(result);
    setDestinationQuery(result.displayName);
    setDestinationLocked(true);
    setDestinationResults([]);
    setSummary(null);
  }, []);

  const updateBatteryPercent = useCallback((value: string) => {
    setBatteryPercent(value);
    setSummary(null);
  }, []);

  const updateVehicleRangeKm = useCallback((value: string) => {
    setVehicleRangeKm(value);
    setSummary(null);
  }, []);

  const planTrip = useCallback(async () => {
    if (!origin || !destination) {
      throw new Error("Select origin and destination.");
    }

    const battery = Number(batteryPercent);
    const maxRange = Number(vehicleRangeKm);
    if (!Number.isFinite(battery) || !Number.isFinite(maxRange) || battery <= 0 || maxRange <= 0) {
      throw new Error("Battery and range must be valid positive values.");
    }

    setPlanning(true);

    try {
      setError(null);
      const route = await getRouteData(
        origin.latitude,
        origin.longitude,
        destination.latitude,
        destination.longitude
      );

      if (!route.ok) {
        throw new Error(route.message);
      }

      const consumedPercent = (route.distanceKm / maxRange) * 100;
      const projectedArrivalPercent = Math.max(0, battery - consumedPercent);
      const reserve = preferredReservePercent ?? vehicles[0]?.defaultReservePercent ?? 12;
      const directFeasible = projectedArrivalPercent >= reserve;

      let recommendedChargers: Charger[] = [];
      if (!directFeasible) {
        const midpointLat = (origin.latitude + destination.latitude) / 2;
        const midpointLng = (origin.longitude + destination.longitude) / 2;
        const chargerPool = await listChargers({ status: "verified" });
        recommendedChargers = chargerPool
          .filter((item) => item.maxPowerKw >= 22)
          .sort((a, b) => {
            const distanceA = haversineKm(
              midpointLat,
              midpointLng,
              a.latitude,
              a.longitude
            );
            const distanceB = haversineKm(
              midpointLat,
              midpointLng,
              b.latitude,
              b.longitude
            );
            if (Math.abs(distanceA - distanceB) > 1) {
              return distanceA - distanceB;
            }
            return b.maxPowerKw - a.maxPowerKw;
          })
          .slice(0, 3);
      }

      if (userId) {
        const tripInput: Parameters<typeof createTrip>[0] = {
          userId,
          origin: {
            label: origin.displayName,
            latitude: origin.latitude,
            longitude: origin.longitude,
          },
          destination: {
            label: destination.displayName,
            latitude: destination.latitude,
            longitude: destination.longitude,
          },
          currentBatteryPercent: battery,
          vehicleMaxRangeKm: maxRange,
          distanceKm: route.distanceKm,
          durationMinutes: route.durationMinutes,
          routePolyline: route.polyline,
          projectedArrivalPercent,
        };

        if (recommendedChargers[0]?.id) {
          tripInput.recommendedChargerId = recommendedChargers[0].id;
        }

        await createTrip(tripInput);
      }

      const result: TripPlannerSummary = {
        distanceKm: route.distanceKm,
        durationMinutes: route.durationMinutes,
        projectedArrivalPercent,
        consumedPercent,
        directFeasible,
        recommendedChargers,
        routePolyline: route.polyline,
      };

      setSummary(result);
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to plan trip.";
      setError(message);
      throw err;
    } finally {
      setPlanning(false);
    }
  }, [
    batteryPercent,
    destination,
    origin,
    preferredReservePercent,
    userId,
    vehicleRangeKm,
    vehicles,
  ]);

  const data = useMemo(
    () => ({
      vehicles,
      primaryVehicle: vehicles[0] || null,
      savedTrips,
      originQuery,
      destinationQuery,
      originResults,
      destinationResults,
      origin,
      destination,
      batteryPercent,
      vehicleRangeKm,
      summary,
      isOriginSearching,
      isDestinationSearching,
    }),
    [
      batteryPercent,
      destination,
      destinationQuery,
      destinationResults,
      isDestinationSearching,
      isOriginSearching,
      origin,
      originQuery,
      originResults,
      savedTrips,
      summary,
      vehicleRangeKm,
      vehicles,
    ]
  );

  return {
    data,
    isLoading,
    isPlanning: planning,
    error,
    refresh,
    actions: {
      setOriginQuery: updateOriginQuery,
      setDestinationQuery: updateDestinationQuery,
      selectOrigin,
      selectDestination,
      setBatteryPercent: updateBatteryPercent,
      setVehicleRangeKm: updateVehicleRangeKm,
      planTrip,
      clearSummary: () => setSummary(null),
    },
  };
}
