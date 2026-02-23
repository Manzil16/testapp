export interface GeoResult {
  displayName: string;
  latitude: number;
  longitude: number;
}

export async function searchAddress(query: string): Promise<GeoResult[]> {
  if (!query || query.length < 3) return [];

 const url =
  "https://nominatim.openstreetmap.org/search?" +
  new URLSearchParams({
    q: query,
    format: "json",
    limit: "5",
    countrycodes: "au", // 🇦🇺 restrict to Australia
  }).toString();

  const response = await fetch(url, {
    headers: {
      "Accept-Language": "en",
    },
  });

  const data = await response.json();

  return data.map((item: any) => ({
    displayName: item.display_name,
    latitude: parseFloat(item.lat),
    longitude: parseFloat(item.lon),
  }));
}
