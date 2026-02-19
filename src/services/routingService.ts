export async function getRouteDistanceKm(
  fromLat: number,
  fromLng: number,
  toLat: number,
  toLng: number
): Promise<number> {
  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${fromLng},${fromLat};${toLng},${toLat}?overview=false`;

    const response = await fetch(url);
    const data = await response.json();

    const meters = data.routes[0].distance;
    return meters / 1000;
  } catch (error) {
    return 0;
  }
}
