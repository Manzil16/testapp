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

type RankedResult = GeoResult & { importance: number; proximityKm: number };

async function searchNominatim(
  normalizedQuery: string,
  options?: SearchAddressOptions
): Promise<RankedResult[]> {
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

  if (
    options?.nearLatitude != null &&
    options?.nearLongitude != null &&
    Number.isFinite(options.nearLatitude) &&
    Number.isFinite(options.nearLongitude)
  ) {
    const spread = 1.8;
    params.viewbox = [
      options.nearLongitude - spread,
      options.nearLatitude - spread,
      options.nearLongitude + spread,
      options.nearLatitude + spread,
    ].join(",");
    params.bounded = "0";
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
    throw new Error(`Nominatim failed with status ${response.status}.`);
  }

  const data = (await response.json()) as {
    lat?: string;
    lon?: string;
    display_name?: string;
    name?: string;
    importance?: number;
    address?: {
      road?: string;
      house_number?: string;
      suburb?: string;
      city?: string;
      town?: string;
      village?: string;
      state?: string;
      postcode?: string;
    };
  }[];

  const nearLat = options?.nearLatitude;
  const nearLng = options?.nearLongitude;

  return data
    .map((item) => {
      const latitude = Number(item.lat);
      const longitude = Number(item.lon);

      const road = item.address?.road;
      const houseNumber = item.address?.house_number;
      const addressPrefix = houseNumber && road ? `${houseNumber} ${road}` : road;
      const primaryText =
        addressPrefix || item.name || item.display_name?.split(",")[0] || "Unknown address";

      const locality =
        item.address?.suburb || item.address?.city || item.address?.town || item.address?.village;
      const secondaryText = [locality, item.address?.state, item.address?.postcode]
        .filter(Boolean)
        .join(", ");

      const proximityKm =
        nearLat != null && nearLng != null
          ? haversineKm(nearLat, nearLng, latitude, longitude)
          : Infinity;

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
      (r) =>
        Number.isFinite(r.latitude) && Number.isFinite(r.longitude) && r.displayName.length > 0
    );
}

async function searchPhoton(
  normalizedQuery: string,
  options?: SearchAddressOptions
): Promise<RankedResult[]> {
  const params: Record<string, string> = {
    q: normalizedQuery,
    limit: "10",
    lang: "en",
  };

  if (
    options?.nearLatitude != null &&
    options?.nearLongitude != null &&
    Number.isFinite(options.nearLatitude) &&
    Number.isFinite(options.nearLongitude)
  ) {
    params.lat = String(options.nearLatitude);
    params.lon = String(options.nearLongitude);
  }

  const url = "https://photon.komoot.io/api/?" + new URLSearchParams(params).toString();

  const response = await fetch(url, {
    headers: { "Accept-Language": "en-AU,en;q=0.9" },
  });

  if (!response.ok) {
    throw new Error(`Photon failed with status ${response.status}.`);
  }

  const data = (await response.json()) as {
    features?: {
      geometry?: { coordinates?: [number, number] };
      properties?: {
        name?: string;
        street?: string;
        housenumber?: string;
        postcode?: string;
        city?: string;
        district?: string;
        county?: string;
        state?: string;
        country?: string;
        countrycode?: string;
      };
    }[];
  };

  const nearLat = options?.nearLatitude;
  const nearLng = options?.nearLongitude;

  return (data.features ?? [])
    .filter((f) => (f.properties?.countrycode ?? "").toUpperCase() === "AU")
    .map((feature) => {
      const coords = feature.geometry?.coordinates;
      const longitude = coords?.[0] ?? NaN;
      const latitude = coords?.[1] ?? NaN;
      const props = feature.properties ?? {};

      const addressPrefix =
        props.housenumber && props.street
          ? `${props.housenumber} ${props.street}`
          : props.street;
      const primaryText = addressPrefix || props.name || "Unknown address";

      const locality = props.city || props.district || props.county;
      const secondaryText = [locality, props.state, props.postcode].filter(Boolean).join(", ");

      const proximityKm =
        nearLat != null && nearLng != null
          ? haversineKm(nearLat, nearLng, latitude, longitude)
          : Infinity;

      return {
        displayName: secondaryText ? `${primaryText}, ${secondaryText}` : primaryText,
        primaryText,
        secondaryText: secondaryText || undefined,
        latitude,
        longitude,
        importance: 0,
        proximityKm,
      };
    })
    .filter(
      (r) =>
        Number.isFinite(r.latitude) && Number.isFinite(r.longitude) && r.displayName.length > 0
    );
}

export async function searchAddress(
  query: string,
  options?: SearchAddressOptions
): Promise<GeoResult[]> {
  const normalizedQuery = query.trim();
  if (normalizedQuery.length < 3) {
    return [];
  }

  let results: RankedResult[] = [];
  let nominatimError: unknown;
  try {
    results = await searchNominatim(normalizedQuery, options);
  } catch (err) {
    nominatimError = err;
  }

  // Fallback to Photon when Nominatim fails or returns nothing (often 429 rate-limited).
  if (results.length === 0) {
    try {
      results = await searchPhoton(normalizedQuery, options);
    } catch (photonErr) {
      // Both providers failed — surface the original error so the UI can show a hint.
      throw nominatimError ?? photonErr;
    }
  }

  const nearLat = options?.nearLatitude;
  const nearLng = options?.nearLongitude;

  results.sort((a, b) => {
    if (nearLat != null && nearLng != null) {
      const proxDiff = a.proximityKm - b.proximityKm;
      if (Math.abs(proxDiff) > 50) return proxDiff;
    }
    return b.importance - a.importance;
  });

  return results
    .slice(0, 8)
    .map(({ displayName, primaryText, secondaryText, latitude, longitude }) => ({
      displayName,
      primaryText,
      secondaryText,
      latitude,
      longitude,
    }));
}
