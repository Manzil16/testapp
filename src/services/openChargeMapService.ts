/**
 * Open Charge Map API v3 integration.
 *
 * Fetches real public EV charging stations near a lat/lng and maps them
 * to the app's Charger type so they can be merged with Supabase-hosted listings.
 *
 * Rate limit: 5 000 requests / day on the free tier.
 * To get your key: https://openchargemap.org/site/develop/api
 */

import type { Charger, ChargerConnector, ConnectorType } from "../features/chargers/charger.types";

// ---------------------------------------------------------------------------
// Configuration — replace with your key
// ---------------------------------------------------------------------------
export const OCM_API_KEY = "e3dd7bf6-831a-40da-b84e-83603a4f4c1e";
const OCM_BASE_URL = "https://api.openchargemap.io/v3/poi/";
const DEFAULT_RADIUS_KM = 10;
const DEFAULT_MAX_RESULTS = 50;
const REQUEST_TIMEOUT_MS = 10_000;

// ---------------------------------------------------------------------------
// OCM raw response shape (only the fields we use)
// ---------------------------------------------------------------------------
interface OcmAddressInfo {
  Title: string;
  AddressLine1: string | null;
  Town: string | null;
  StateOrProvince: string | null;
  Postcode: string | null;
  Latitude: number;
  Longitude: number;
  Distance: number | null;
}

interface OcmConnection {
  ConnectionTypeID: number | null;
  PowerKW: number | null;
  CurrentTypeID: number | null;
  LevelID: number | null;
}

interface OcmPoi {
  ID: number;
  AddressInfo: OcmAddressInfo;
  Connections: OcmConnection[] | null;
  StatusType: { IsOperational: boolean | null } | null;
  OperatorInfo: { Title: string | null } | null;
  UsageType: { Title: string | null } | null;
}

// ---------------------------------------------------------------------------
// Connector type mapping: OCM ConnectionTypeID → app ConnectorType
// ---------------------------------------------------------------------------
const CONNECTOR_MAP: Record<number, ConnectorType> = {
  1:    "Type2",    // Type 1 — map to Type 2 as closest CCS-family option
  2:    "CHAdeMO",
  25:   "Type2",    // IEC 62196-2 Type 2 (Mennekes)
  27:   "CHAdeMO",
  32:   "CCS2",     // CCS (Type 1 combo)
  33:   "CCS2",     // CCS (Type 2 combo)
  8:    "Tesla",    // Tesla proprietary
  1036: "Type2",    // Tesla (European) — Mennekes
};

function mapConnectionTypeId(id: number | null): ConnectorType | null {
  if (id === null) return null;
  return CONNECTOR_MAP[id] ?? null;
}

// ---------------------------------------------------------------------------
// Transform a single OCM POI to the app Charger shape
// ---------------------------------------------------------------------------
function mapOcmPoi(poi: OcmPoi): Charger {
  const addr = poi.AddressInfo;

  // Build connector list — deduplicate by type, keep the highest power per type
  const connectorMap = new Map<ConnectorType, number>();
  for (const conn of poi.Connections ?? []) {
    const type = mapConnectionTypeId(conn.ConnectionTypeID);
    if (!type) continue;
    const kw = conn.PowerKW ?? 0;
    const existing = connectorMap.get(type) ?? 0;
    if (kw > existing) connectorMap.set(type, kw);
  }

  const connectors: ChargerConnector[] = Array.from(connectorMap.entries()).map(
    ([type, powerKw]) => ({ type, powerKw, count: 1 })
  );

  const maxPowerKw = connectors.reduce((max, c) => Math.max(max, c.powerKw), 0);

  const isOperational = poi.StatusType?.IsOperational ?? true;

  return {
    // Prefix "ocm-" so IDs never clash with Supabase UUIDs
    id:             `ocm-${poi.ID}`,
    hostUserId:     "ocm",
    name:           addr.Title,
    address:        addr.AddressLine1 ?? addr.Title,
    suburb:         addr.Town ?? "",
    state:          addr.StateOrProvince ?? "",
    latitude:       addr.Latitude,
    longitude:      addr.Longitude,
    maxPowerKw:     maxPowerKw || 7,          // default 7 kW if unknown
    pricingPerKwh:  0.45,                     // OCM has no pricing data
    connectors:     connectors.length > 0 ? connectors : [{ type: "Type2", powerKw: 7, count: 1 }],
    amenities:      [],
    availabilityNote: poi.UsageType?.Title ?? "",
    images:         [],
    status:         isOperational ? "approved" : "rejected",
    verificationScore: 75,                    // real but unverified by VehicleGrid
    createdAtIso:   new Date(0).toISOString(),
    updatedAtIso:   new Date(0).toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------
export interface FetchOcmChargersOptions {
  latitude: number;
  longitude: number;
  radiusKm?: number;
  maxResults?: number;
}

/**
 * Fetch real EV charging stations from Open Charge Map near a location.
 * Returns an empty array (never throws) so callers degrade gracefully.
 */
export async function fetchOcmChargers(opts: FetchOcmChargersOptions): Promise<Charger[]> {
  const { latitude, longitude, radiusKm = DEFAULT_RADIUS_KM, maxResults = DEFAULT_MAX_RESULTS } = opts;

  const params = new URLSearchParams({
    key:          OCM_API_KEY,
    latitude:     String(latitude),
    longitude:    String(longitude),
    distance:     String(radiusKm),
    distanceunit: "km",
    maxresults:   String(maxResults),
    compact:      "true",
    verbose:      "false",
    output:       "json",
  });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const res = await fetch(`${OCM_BASE_URL}?${params.toString()}`, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });

    if (!res.ok) {
      console.warn(`[OCM] API error ${res.status}: ${res.statusText}`);
      return [];
    }

    const json: OcmPoi[] = await res.json();
    return json.map(mapOcmPoi);
  } catch (err) {
    if ((err as Error).name === "AbortError") {
      console.warn("[OCM] Request timed out");
    } else {
      console.warn("[OCM] Fetch failed:", err);
    }
    return [];
  } finally {
    clearTimeout(timer);
  }
}
