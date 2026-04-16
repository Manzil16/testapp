import { supabase } from "../lib/supabase";

export interface RouteData {
  distanceKm: number;
  durationMinutes: number;
  polyline: string;
}

export interface RoutePlanInput {
  originLat: number;
  originLng: number;
  destLat: number;
  destLng: number;
  vehicleId: string;
  currentSocPercent: number;
  connectorType?: string;
}

export interface RecommendedStop {
  chargerId: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  maxPowerKw: number;
  pricePerKwh: number;
  source: "vehiclegrid" | "public";
  connectorTypes: string[];
  distanceFromRouteKm: number;
  fractionAlongRoute: number;
  socAtArrivalPercent: number;
  socAfterChargePercent: number;
  estimatedChargeMinutes: number;
  kwhToAdd: number;
  score: number;
}

export interface RoutePlanResult {
  route: RouteData;
  energyEstimate: {
    energyNeededKwh: number;
    efficiencyKwhPer100km: number;
    batteryCapacityKwh: number;
  };
  currentSocPercent: number;
  arrivalSocPercent: number;
  needsChargingStop: boolean;
  recommendedStops: RecommendedStop[];
  vehicleName?: string;
  connectorType?: string;
}

export type RoutingErrorCode =
  | "NETWORK_ERROR"
  | "NO_ROUTE"
  | "INVALID_RESPONSE";

export interface RoutingFailure {
  ok: false;
  code: RoutingErrorCode;
  message: string;
}

export interface RoutingSuccess extends RouteData {
  ok: true;
}

export type RoutingResult = RoutingSuccess | RoutingFailure;

/**
 * Full trip plan via the route-plan edge function.
 * Handles OSRM routing, energy calculation, SoC estimation, and charger ranking — all backend.
 */
export async function getRoutePlan(input: RoutePlanInput): Promise<RoutePlanResult> {
  const { data, error } = await supabase.functions.invoke("route-plan", { body: input });
  if (error) throw new Error(error.message || "Route planning failed");
  if (data?.error) throw new Error(String(data.error));
  return data as RoutePlanResult;
}

/**
 * Simple route fetch — calls the route-plan edge function with a placeholder vehicleId.
 * Use getRoutePlan() directly when vehicle + SoC context is available.
 */
export async function getRoute(
  from: { latitude: number; longitude: number },
  to: { latitude: number; longitude: number },
  options?: { vehicleId?: string; currentSocPercent?: number; signal?: AbortSignal }
): Promise<RouteData> {
  // If no vehicleId is provided, fall back to calling OSRM directly (map display only)
  if (!options?.vehicleId) {
    const result = await getRouteData(from.latitude, from.longitude, to.latitude, to.longitude, options?.signal);
    if (!result.ok) throw new Error(result.message);
    return { distanceKm: result.distanceKm, durationMinutes: result.durationMinutes, polyline: result.polyline };
  }

  const plan = await getRoutePlan({
    originLat: from.latitude,
    originLng: from.longitude,
    destLat: to.latitude,
    destLng: to.longitude,
    vehicleId: options.vehicleId,
    currentSocPercent: Math.min(100, Math.max(0, options.currentSocPercent ?? 80)),
  });
  return plan.route;
}

/**
 * Low-level OSRM call — used as fallback when no vehicle context is available.
 * Prefer getRoutePlan() for trip planning screens.
 */
export async function getRouteData(
  fromLat: number,
  fromLng: number,
  toLat: number,
  toLng: number,
  signal?: AbortSignal
): Promise<RoutingResult> {
  try {
    const url =
      `https://router.project-osrm.org/route/v1/driving/` +
      `${fromLng},${fromLat};${toLng},${toLat}` +
      `?overview=full&geometries=polyline`;

    const response = await fetch(url, { signal });

    if (!response.ok) {
      return {
        ok: false,
        code: "NETWORK_ERROR",
        message: `Routing request failed with status ${response.status}.`,
      };
    }

    const data = (await response.json()) as {
      routes?: { distance?: number; duration?: number; geometry?: string }[];
    };

    const route = data.routes?.[0];

    if (
      !route ||
      typeof route.distance !== "number" ||
      typeof route.duration !== "number" ||
      typeof route.geometry !== "string"
    ) {
      return {
        ok: false,
        code: "NO_ROUTE",
        message: "No valid route was found between the selected locations.",
      };
    }

    return {
      ok: true,
      distanceKm: route.distance / 1000,
      durationMinutes: route.duration / 60,
      polyline: route.geometry,
    };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return {
        ok: false,
        code: "INVALID_RESPONSE",
        message: "Routing request was canceled.",
      };
    }

    return {
      ok: false,
      code: "NETWORK_ERROR",
      message: "Unable to reach routing service. Check connection and try again.",
    };
  }
}
