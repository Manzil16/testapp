export interface RouteData {
  distanceKm: number;
  durationMinutes: number;
  polyline: string;
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

export async function getRoute(
  from: { latitude: number; longitude: number },
  to: { latitude: number; longitude: number },
  signal?: AbortSignal
): Promise<RouteData> {
  const result = await getRouteData(from.latitude, from.longitude, to.latitude, to.longitude, signal);
  if (!result.ok) {
    throw new Error(result.message);
  }
  return { distanceKm: result.distanceKm, durationMinutes: result.durationMinutes, polyline: result.polyline };
}

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
