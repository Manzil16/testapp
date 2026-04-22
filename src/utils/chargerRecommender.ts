/**
 * Charger recommendation scoring for the trip planner.
 * Weights: detour distance (40%), price (30%), rating (20%), availability (10%).
 */

export const MAX_DETOUR_KM = 5;

interface ScoredCharger {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  pricingPerKwh: number;
  averageRating?: number;
  status: string;
  connectors?: Array<{ type: string }>;
}

interface RoutePoint {
  latitude: number;
  longitude: number;
}

const DEFAULT_WEIGHTS = {
  detour: 0.4,
  price: 0.3,
  rating: 0.2,
  availability: 0.1,
};

/**
 * Calculate the haversine distance between two coordinates in km.
 */
function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Estimate how far off-route a charger is by finding the minimum distance
 * to any point along the route polyline (sampled).
 */
function getDetourDistanceKm(charger: ScoredCharger, routePoints: RoutePoint[]): number {
  if (routePoints.length === 0) {
    return Infinity;
  }

  let minDist = Infinity;
  for (const point of routePoints) {
    const dist = haversineKm(charger.latitude, charger.longitude, point.latitude, point.longitude);
    if (dist < minDist) minDist = dist;
  }
  return minDist;
}

/**
 * Score a single charger for recommendation.
 * Returns a value between 0 and 1 (higher is better).
 */
export function scoreCharger(
  charger: ScoredCharger,
  routePoints: RoutePoint[],
  weights = DEFAULT_WEIGHTS
): number {
  const detourKm = getDetourDistanceKm(charger, routePoints);

  // Reject chargers more than MAX_DETOUR_KM off route
  if (detourKm > MAX_DETOUR_KM) return -1;

  const detourScore = Math.max(0, 1 - detourKm / MAX_DETOUR_KM);
  const priceScore = Math.max(0, 1 - (charger.pricingPerKwh - 0.35) / 0.50);
  const ratingScore = (charger.averageRating ?? 3) / 5;
  const availScore = charger.status === "approved" ? 1 : 0;

  return (
    weights.detour * detourScore +
    weights.price * priceScore +
    weights.rating * ratingScore +
    weights.availability * availScore
  );
}

/**
 * Rank chargers by recommendation score and return the best match.
 * Returns null if no charger is within the detour threshold.
 */
export function recommendCharger(
  chargers: ScoredCharger[],
  routePoints: RoutePoint[]
): ScoredCharger | null {
  let bestCharger: ScoredCharger | null = null;
  let bestScore = -1;

  for (const charger of chargers) {
    const score = scoreCharger(charger, routePoints);
    if (score > bestScore) {
      bestScore = score;
      bestCharger = charger;
    }
  }

  return bestCharger;
}

export interface RouteCandidate<T extends ScoredCharger = ScoredCharger> {
  charger: T;
  detourKm: number;
  score: number;
}

export interface RankOptions {
  /** Filter out chargers further than this from any route point. Default MAX_DETOUR_KM (5km). */
  maxDetourKm?: number;
  /** If set, keep only chargers with at least one matching connector. */
  connectorType?: string;
}

/**
 * Rank every charger within the route corridor. Returns sorted list (best first).
 * Unlike recommendCharger(), this returns ALL compatible candidates, not just the top one.
 */
export function rankChargersAlongRoute<T extends ScoredCharger>(
  chargers: T[],
  routePoints: RoutePoint[],
  options: RankOptions = {},
): RouteCandidate<T>[] {
  const maxDetour = options.maxDetourKm ?? MAX_DETOUR_KM;
  const required = options.connectorType?.trim();

  const results: RouteCandidate<T>[] = [];
  for (const charger of chargers) {
    if (required && charger.connectors && charger.connectors.length > 0) {
      const match = charger.connectors.some((c) => c.type === required);
      if (!match) continue;
    }

    const detourKm = getDetourDistanceKm(charger, routePoints);
    if (detourKm > maxDetour) continue;

    const score = scoreCharger(charger, routePoints);
    if (score < 0) continue;

    results.push({ charger, detourKm, score });
  }

  results.sort((a, b) => b.score - a.score);
  return results;
}
