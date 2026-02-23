export interface RouteData {
  distanceKm: number;
  durationMinutes: number;
  polyline: string;
}

export async function getRouteData(
  fromLat: number,
  fromLng: number,
  toLat: number,
  toLng: number
): Promise<RouteData | null> {
  try {
    const url =
      `https://router.project-osrm.org/route/v1/driving/` +
      `${fromLng},${fromLat};${toLng},${toLat}` +
      `?overview=full&geometries=polyline`;

    const response = await fetch(url);
    const data = await response.json();

    const route = data.routes[0];

    return {
      distanceKm: route.distance / 1000,
      durationMinutes: route.duration / 60,
      polyline: route.geometry,
    };
  } catch (error) {
    return null;
  }
}