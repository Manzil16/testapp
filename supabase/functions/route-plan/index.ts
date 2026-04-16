import { createClient } from "npm:@supabase/supabase-js@2.39.0";

// ─── Algorithm overview ────────────────────────────────────────────────────────
// 1. Fetch vehicle (battery capacity, efficiency, reserve SoC) from DB
// 2. Get driving route from OSRM (polyline + distance + duration)
// 3. Decode polyline → array of lat/lng points
// 4. Calculate energy needed and arrival SoC
// 5. For each charger candidate (VehicleGrid + Open Charge Map):
//    a. Project charger onto nearest point on polyline → detour distance + fraction along route
//    b. Calculate SoC when driver arrives at charger (may be < 0 → skip)
//    c. Calculate how much to charge + how long it takes
//    d. Score: lower detour × faster charger × cheaper price
// 6. Deduplicate nearby stops, return top 5

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

// ─── Types ────────────────────────────────────────────────────────────────────

interface LatLng { lat: number; lng: number }

interface RouteInput {
  originLat: number;
  originLng: number;
  destLat: number;
  destLng: number;
  vehicleId: string;
  currentSocPercent: number;
  connectorType?: string;
}

interface RecommendedStop {
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

// ─── Geometry helpers ─────────────────────────────────────────────────────────

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Decode a Google-encoded polyline string (precision 5) into lat/lng points.
 * OSRM returns this format when geometries=polyline is requested.
 */
function decodePolyline(encoded: string): LatLng[] {
  const points: LatLng[] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;
  while (index < encoded.length) {
    let shift = 0, result = 0, byte: number;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    lat += result & 1 ? ~(result >> 1) : result >> 1;

    shift = 0; result = 0;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    lng += result & 1 ? ~(result >> 1) : result >> 1;

    points.push({ lat: lat / 1e5, lng: lng / 1e5 });
  }
  return points;
}

function buildSegmentLengths(points: LatLng[]): number[] {
  return points.slice(0, -1).map((p, i) =>
    haversineKm(p.lat, p.lng, points[i + 1].lat, points[i + 1].lng)
  );
}

/**
 * Project a point (charger) onto the route polyline.
 * Returns:
 *   distanceFromRouteKm — how far the charger is from the nearest point on the route
 *   fractionAlongRoute  — 0-1, how far along the trip that nearest point is
 *
 * Algorithm: for each polyline segment, find the closest point on that segment to
 * the charger using vector projection (dot product). Track the best (closest) match.
 */
function projectOntoRoute(
  chargerLat: number,
  chargerLng: number,
  points: LatLng[],
  segmentLengths: number[],
  totalLengthKm: number
): { distanceFromRouteKm: number; fractionAlongRoute: number } {
  let bestDist = Infinity;
  let bestFraction = 0;
  let cumulativeKm = 0;

  for (let i = 0; i < points.length - 1; i++) {
    const ax = points[i].lng, ay = points[i].lat;
    const bx = points[i + 1].lng, by = points[i + 1].lat;
    const abx = bx - ax, aby = by - ay;
    const len2 = abx * abx + aby * aby;
    // t = how far along this segment the closest point is (0 = start, 1 = end)
    const t = len2 > 0
      ? Math.max(0, Math.min(1, ((chargerLng - ax) * abx + (chargerLat - ay) * aby) / len2))
      : 0;
    const snapLat = ay + t * aby;
    const snapLng = ax + t * abx;
    const dist = haversineKm(chargerLat, chargerLng, snapLat, snapLng);

    if (dist < bestDist) {
      bestDist = dist;
      // fraction = (km already covered on previous segments + fraction of this segment) / total
      bestFraction = totalLengthKm > 0
        ? (cumulativeKm + t * segmentLengths[i]) / totalLengthKm
        : 0;
    }
    cumulativeKm += segmentLengths[i];
  }

  return { distanceFromRouteKm: bestDist, fractionAlongRoute: bestFraction };
}

// ─── OSRM ────────────────────────────────────────────────────────────────────

async function fetchOsrmRoute(
  originLat: number, originLng: number,
  destLat: number, destLng: number
): Promise<{ distanceKm: number; durationMinutes: number; polyline: string }> {
  const url =
    `https://router.project-osrm.org/route/v1/driving/` +
    `${originLng},${originLat};${destLng},${destLat}` +
    `?overview=full&geometries=polyline`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`OSRM request failed: ${res.status}`);
  const data = await res.json() as {
    routes?: { distance?: number; duration?: number; geometry?: string }[]
  };
  const route = data.routes?.[0];
  if (!route?.distance || !route?.duration || !route?.geometry) {
    throw new Error("No route found between these locations.");
  }
  return {
    distanceKm: route.distance / 1000,
    durationMinutes: Math.round(route.duration / 60),
    polyline: route.geometry,
  };
}

// ─── Open Charge Map ──────────────────────────────────────────────────────────

const OCM_CONNECTOR_NAMES: Record<number, string> = {
  1: "J1772", 2: "CHAdeMO", 25: "Type 2",
  30: "Tesla", 32: "CCS1", 33: "CCS2",
};

async function fetchOcmChargers(
  midLat: number, midLng: number, radiusKm: number
): Promise<{
  chargerId: string; name: string; address: string;
  latitude: number; longitude: number;
  maxPowerKw: number; connectorTypes: string[];
}[]> {
  try {
    const params = new URLSearchParams({
      output: "json",
      latitude: String(midLat),
      longitude: String(midLng),
      distance: String(Math.min(200, Math.ceil(radiusKm))),
      distanceunit: "km",
      maxresults: "60",
      compact: "true",
      verbose: "false",
      countrycode: "AU",
    });
    const res = await fetch(`https://api.openchargemap.io/v3/poi/?${params}`, {
      headers: { "User-Agent": "VehicleGrid-App/1.0" },
    });
    if (!res.ok) return [];
    const data = await res.json() as {
      ID?: number;
      AddressInfo?: { Title?: string; AddressLine1?: string; Latitude?: number; Longitude?: number };
      Connections?: { ConnectionTypeID?: number; PowerKW?: number }[];
    }[];
    return data.flatMap((s) => {
      const lat = s.AddressInfo?.Latitude;
      const lng = s.AddressInfo?.Longitude;
      if (!lat || !lng) return [];
      const connections = s.Connections ?? [];
      const maxPowerKw = Math.max(0, ...connections.map((c) => c.PowerKW ?? 0));
      const connectorTypes = [...new Set(
        connections.map((c) => OCM_CONNECTOR_NAMES[c.ConnectionTypeID ?? 0]).filter(Boolean) as string[]
      )];
      return [{
        chargerId: `ocm-${s.ID}`,
        name: s.AddressInfo?.Title ?? "Public charger",
        address: s.AddressInfo?.AddressLine1 ?? "",
        latitude: lat, longitude: lng,
        maxPowerKw: maxPowerKw || 7,
        connectorTypes,
      }];
    });
  } catch {
    return []; // OCM is optional — don't fail the whole plan if it's unavailable
  }
}

// ─── Stop builder ─────────────────────────────────────────────────────────────

const MAX_DETOUR_KM = 20;
const SAFETY_BUFFER_SOC = 10; // minimum SoC% to arrive at a charger with

function buildStop(params: {
  chargerId: string; name: string; address: string;
  latitude: number; longitude: number;
  maxPowerKw: number; pricePerKwh: number;
  source: "vehiclegrid" | "public"; connectorTypes: string[];
  fractionAlongRoute: number; distanceFromRouteKm: number;
  distanceKm: number; batteryCapacityKwh: number;
  efficiencyKwhPer100km: number; currentSocPercent: number;
  vehicleMaxChargePowerKw: number; reservePercent: number;
}): RecommendedStop | null {
  const {
    fractionAlongRoute, distanceKm, batteryCapacityKwh,
    efficiencyKwhPer100km, currentSocPercent,
    vehicleMaxChargePowerKw, reservePercent, distanceFromRouteKm,
    maxPowerKw, pricePerKwh,
  } = params;

  // How much battery do we have when we arrive at the charger?
  const kmToCharger = fractionAlongRoute * distanceKm;
  const energyToChargerKwh = (kmToCharger / 100) * efficiencyKwhPer100km;
  const batteryAtStartKwh = (currentSocPercent / 100) * batteryCapacityKwh;
  const batteryAtChargerKwh = batteryAtStartKwh - energyToChargerKwh;
  const socAtArrivalPercent = (batteryAtChargerKwh / batteryCapacityKwh) * 100;

  // Skip if we'd arrive below the safety buffer (can't safely reach this charger)
  if (socAtArrivalPercent < SAFETY_BUFFER_SOC) return null;

  // How much do we need to charge to reach the destination with the reserve intact?
  const kmFromCharger = (1 - fractionAlongRoute) * distanceKm;
  const energyFromChargerKwh = (kmFromCharger / 100) * efficiencyKwhPer100km;
  const reserveKwh = (reservePercent / 100) * batteryCapacityKwh;
  const minBatteryNeededKwh = energyFromChargerKwh + reserveKwh;

  // Target: enough to reach dest with reserve + 15% buffer, never above 90%
  const targetSocPercent = Math.min(90, (minBatteryNeededKwh / batteryCapacityKwh) * 100 + 15);
  const kwhToAdd = Math.max(0, (targetSocPercent / 100) * batteryCapacityKwh - batteryAtChargerKwh);

  // Charge time = kWh needed / effective power (limited by vehicle's max accept rate)
  const effectivePowerKw = Math.min(maxPowerKw, vehicleMaxChargePowerKw);
  const estimatedChargeMinutes = effectivePowerKw > 0
    ? Math.round((kwhToAdd / effectivePowerKw) * 60)
    : 60;

  const socAfterChargePercent = Math.min(100,
    ((batteryAtChargerKwh + kwhToAdd) / batteryCapacityKwh) * 100
  );

  // Score: lower detour is best, then faster charger, then cheaper price
  const detourScore = Math.max(0, 100 - distanceFromRouteKm * 8); // 0-100
  const powerScore  = Math.min(100, maxPowerKw * 1.5);             // faster = higher
  const priceScore  = pricePerKwh === 0 ? 80 : Math.max(0, 100 - pricePerKwh * 50);
  const score = detourScore * 0.40 + powerScore * 0.35 + priceScore * 0.25;

  return {
    chargerId: params.chargerId,
    name: params.name,
    address: params.address,
    latitude: params.latitude,
    longitude: params.longitude,
    maxPowerKw,
    pricePerKwh,
    source: params.source,
    connectorTypes: params.connectorTypes,
    distanceFromRouteKm: Math.round(distanceFromRouteKm * 10) / 10,
    fractionAlongRoute: Math.round(fractionAlongRoute * 1000) / 1000,
    socAtArrivalPercent: Math.round(socAtArrivalPercent * 10) / 10,
    socAfterChargePercent: Math.round(socAfterChargePercent * 10) / 10,
    estimatedChargeMinutes,
    kwhToAdd: Math.round(kwhToAdd * 10) / 10,
    score: Math.round(score * 10) / 10,
  };
}

// ─── Main handler ─────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };
  const json = (payload: unknown, status = 200) =>
    new Response(JSON.stringify(payload), { status, headers: jsonHeaders });

  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  let input: RouteInput;
  try { input = await req.json(); }
  catch { return json({ error: "Invalid JSON body" }, 400); }

  const { originLat, originLng, destLat, destLng, vehicleId, currentSocPercent } = input;
  if (!originLat || !originLng || !destLat || !destLng || !vehicleId) {
    return json({ error: "originLat, originLng, destLat, destLng, vehicleId are required" }, 400);
  }

  // ── 1. Fetch vehicle from DB ──
  const { data: v, error: vErr } = await supabase
    .from("vehicles")
    .select("make, model, battery_capacity_kwh, efficiency_kwh_per_100km, real_world_efficiency_kwh_per_100km, default_reserve_percent, max_charge_power_kw, connector_type, max_range_km")
    .eq("id", vehicleId)
    .single();
  if (vErr || !v) return json({ error: "Vehicle not found." }, 404);

  const batteryCapacityKwh = Number(v.battery_capacity_kwh) || 60;
  const reservePercent     = Number(v.default_reserve_percent) || 15;
  const vehicleMaxKw       = Number(v.max_charge_power_kw) || 11;

  // Prefer real-world calibrated efficiency if driver has done a calibration run
  const efficiencyKwhPer100km =
    Number(v.real_world_efficiency_kwh_per_100km) ||
    Number(v.efficiency_kwh_per_100km) ||
    (v.battery_capacity_kwh && v.max_range_km
      ? (Number(v.battery_capacity_kwh) / Number(v.max_range_km)) * 100
      : 18);

  const safeSoc = Math.min(100, Math.max(0, Number(currentSocPercent) || 80));

  // ── 2. Get route from OSRM ──
  let routeData: { distanceKm: number; durationMinutes: number; polyline: string };
  try { routeData = await fetchOsrmRoute(originLat, originLng, destLat, destLng); }
  catch (err) { return json({ error: err instanceof Error ? err.message : "Route failed" }, 502); }

  const { distanceKm, durationMinutes, polyline } = routeData;

  // ── 3. Decode polyline into points + build segment geometry ──
  const routePoints    = decodePolyline(polyline);
  const segmentLengths = buildSegmentLengths(routePoints);
  const totalLengthKm  = segmentLengths.reduce((s, d) => s + d, 0);

  // ── 4. Energy math ──
  const energyNeededKwh    = (distanceKm / 100) * efficiencyKwhPer100km;
  const batteryAtStartKwh  = (safeSoc / 100) * batteryCapacityKwh;
  const arrivalBatteryKwh  = batteryAtStartKwh - energyNeededKwh;
  const arrivalSocPercent  = (arrivalBatteryKwh / batteryCapacityKwh) * 100;
  const needsChargingStop  = arrivalSocPercent < reservePercent;

  // ── 5. Fetch charger candidates (VehicleGrid + Open Charge Map) in parallel ──
  const midLat = (originLat + destLat) / 2;
  const midLng = (originLng + destLng) / 2;
  const searchRadiusKm = Math.max(60, distanceKm / 2 + 30);

  const [vgResult, ocmStations] = await Promise.all([
    supabase
      .from("chargers")
      .select("id, name, address, lat, lng, max_power_kw, price_per_kwh, connectors")
      .eq("status", "approved"),
    fetchOcmChargers(midLat, midLng, searchRadiusKm),
  ]);

  const vgChargers = (vgResult.data ?? []) as {
    id: string; name: string; address: string;
    lat: unknown; lng: unknown;
    max_power_kw: unknown; price_per_kwh: unknown;
    connectors: { type: string }[] | null;
  }[];

  // ── 6. Score every candidate with the "along route" algorithm ──
  const candidates: RecommendedStop[] = [];
  const commonParams = {
    distanceKm, batteryCapacityKwh, efficiencyKwhPer100km,
    currentSocPercent: safeSoc, vehicleMaxChargePowerKw: vehicleMaxKw, reservePercent,
  };

  for (const c of vgChargers) {
    const lat = Number(c.lat), lng = Number(c.lng);
    if (!lat || !lng) continue;
    const { distanceFromRouteKm, fractionAlongRoute } = projectOntoRoute(
      lat, lng, routePoints, segmentLengths, totalLengthKm
    );
    if (distanceFromRouteKm > MAX_DETOUR_KM) continue;
    // Only consider chargers meaningfully along the route (5%–98%)
    if (fractionAlongRoute < 0.05 || fractionAlongRoute > 0.98) continue;
    const stop = buildStop({
      chargerId: c.id, name: c.name, address: c.address,
      latitude: lat, longitude: lng,
      maxPowerKw: Number(c.max_power_kw) || 7,
      pricePerKwh: Number(c.price_per_kwh) || 0,
      source: "vehiclegrid",
      connectorTypes: (c.connectors ?? []).map((x) => x.type),
      fractionAlongRoute, distanceFromRouteKm, ...commonParams,
    });
    if (stop) candidates.push(stop);
  }

  for (const s of ocmStations) {
    const { distanceFromRouteKm, fractionAlongRoute } = projectOntoRoute(
      s.latitude, s.longitude, routePoints, segmentLengths, totalLengthKm
    );
    if (distanceFromRouteKm > MAX_DETOUR_KM) continue;
    if (fractionAlongRoute < 0.05 || fractionAlongRoute > 0.98) continue;
    const stop = buildStop({
      chargerId: s.chargerId, name: s.name, address: s.address,
      latitude: s.latitude, longitude: s.longitude,
      maxPowerKw: s.maxPowerKw, pricePerKwh: 0,
      source: "public", connectorTypes: s.connectorTypes,
      fractionAlongRoute, distanceFromRouteKm, ...commonParams,
    });
    if (stop) candidates.push(stop);
  }

  // ── 7. Sort, deduplicate, return top 5 ──
  candidates.sort((a, b) => b.score - a.score);

  const deduplicated: RecommendedStop[] = [];
  for (const stop of candidates) {
    // Skip if we already have a stop very close to this one on the route
    const tooClose = deduplicated.some(
      (s) =>
        Math.abs(s.fractionAlongRoute - stop.fractionAlongRoute) < 0.05 &&
        haversineKm(s.latitude, s.longitude, stop.latitude, stop.longitude) < 2
    );
    if (!tooClose) deduplicated.push(stop);
    if (deduplicated.length >= 5) break;
  }

  return json({
    route: { distanceKm: Math.round(distanceKm * 10) / 10, durationMinutes, polyline },
    energyEstimate: {
      energyNeededKwh: Math.round(energyNeededKwh * 10) / 10,
      efficiencyKwhPer100km: Math.round(efficiencyKwhPer100km * 10) / 10,
      batteryCapacityKwh,
    },
    currentSocPercent: safeSoc,
    arrivalSocPercent: Math.round(arrivalSocPercent * 10) / 10,
    needsChargingStop,
    recommendedStops: deduplicated,
    vehicleName: [v.make, v.model].filter(Boolean).join(" ") || "Your vehicle",
    connectorType: (v.connector_type as string) || "Type2",
  });
});
