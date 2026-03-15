export interface GeoResult {
  displayName: string;
  primaryText: string;
  secondaryText?: string;
  latitude: number;
  longitude: number;
}

interface SearchAddressOptions {
  /** User's current latitude for proximity ranking */
  nearLatitude?: number;
  /** User's current longitude for proximity ranking */
  nearLongitude?: number;
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (v: number) => (v * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export async function searchAddress(
  query: string,
  options?: SearchAddressOptions
): Promise<GeoResult[]> {
  const normalizedQuery = query.trim();
  if (normalizedQuery.length < 3) {
    return [];
  }

  const regionBiasedQuery = /\baustralia\b|\bau\b/i.test(normalizedQuery)
    ? normalizedQuery
    : `${normalizedQuery}, Australia`;

  const params: Record<string, string> = {
    q: regionBiasedQuery,
    format: "jsonv2",
    addressdetails: "1",
    dedupe: "1",
    limit: "10",
    countrycodes: "au",
  };

  // Bias results toward the user's location if available
  if (
    options?.nearLatitude != null &&
    options?.nearLongitude != null &&
    Number.isFinite(options.nearLatitude) &&
    Number.isFinite(options.nearLongitude)
  ) {
    // Nominatim viewbox: a bounding box ~200 km around the user
    const spread = 1.8; // ~200 km in degrees
    params.viewbox = [
      options.nearLongitude - spread,
      options.nearLatitude - spread,
      options.nearLongitude + spread,
      options.nearLatitude + spread,
    ].join(",");
    params.bounded = "0"; // Prefer viewbox results but don't exclude others
  }

  const url =
    "https://nominatim.openstreetmap.org/search?" +
    new URLSearchParams(params).toString();

  const response = await fetch(url, {
    headers: {
      "User-Agent": "VehicleGrid-App/1.0 (vehiclegrid-app)",
      "Accept-Language": "en-AU,en;q=0.9",
    },
  });

  if (!response.ok) {
    throw new Error(`Geocoding request failed with status ${response.status}.`);
  }

  const data = (await response.json()) as {
    lat?: string;
    lon?: string;
    display_name?: string;
    name?: string;
    importance?: number;
    type?: string;
    class?: string;
    address?: {
      road?: string;
      house_number?: string;
      suburb?: string;
      city?: string;
      town?: string;
      village?: string;
      state?: string;
      postcode?: string;
      country?: string;
    };
  }[];

  const nearLat = options?.nearLatitude;
  const nearLng = options?.nearLongitude;

  const results = data
    .map((item) => {
      const latitude = Number(item.lat);
      const longitude = Number(item.lon);

      // Build a precise primary text
      const road = item.address?.road;
      const houseNumber = item.address?.house_number;
      const addressPrefix = houseNumber && road ? `${houseNumber} ${road}` : road;
      const primaryText =
        addressPrefix || item.name || item.display_name?.split(",")[0] || "Unknown address";

      const locality =
        item.address?.suburb || item.address?.city || item.address?.town || item.address?.village;
      const secondaryParts = [
        locality,
        item.address?.state,
        item.address?.postcode,
      ].filter(Boolean);
      const secondaryText = secondaryParts.join(", ");

      // Compute proximity score if user location is available
      let proximityKm = Infinity;
      if (nearLat != null && nearLng != null) {
        proximityKm = haversineKm(nearLat, nearLng, latitude, longitude);
      }

      return {
        displayName: secondaryText ? `${primaryText}, ${secondaryText}` : primaryText,
        primaryText,
        secondaryText: secondaryText || undefined,
        latitude,
        longitude,
        importance: item.importance ?? 0,
        proximityKm,
      };
    })
    .filter(
      (item) =>
        Number.isFinite(item.latitude) &&
        Number.isFinite(item.longitude) &&
        item.displayName.length > 0
    );

  // Sort: blend importance and proximity
  results.sort((a, b) => {
    if (nearLat != null && nearLng != null) {
      // Weight proximity heavily — closer results first, then by importance
      const proxDiff = a.proximityKm - b.proximityKm;
      if (Math.abs(proxDiff) > 50) {
        return proxDiff;
      }
    }
    return b.importance - a.importance;
  });

  return results.slice(0, 8).map(({ displayName, primaryText, secondaryText, latitude, longitude }) => ({
    displayName,
    primaryText,
    secondaryText,
    latitude,
    longitude,
  }));
}
