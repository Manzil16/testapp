import type { Charger } from "../models/Charger";
import { DEFAULT_RESERVE_PERCENT } from "../utils/constants";

/**
 * Sort chargers by power descending
 */
function sortByPowerDescending(chargers: Charger[]): Charger[] {
  return [...chargers].sort((a, b) => b.powerKw - a.powerKw);
}

/**
 * Filter only high-power chargers (commercial fast charging threshold)
 */
function filterFastChargers(chargers: Charger[]): Charger[] {
  return chargers.filter((c) => c.powerKw >= 150);
}

/**
 * Recommend charger based on arrival battery
 */
export function recommendCharger(
  arrivalBattery: number,
  chargerList: Charger[],
  safetyReservePercent: number = DEFAULT_RESERVE_PERCENT
): Charger | null {
  if (arrivalBattery >= safetyReservePercent) {
    return null;
  }

  // Remove flagged chargers
  const trusted = chargerList.filter(
    (c) => c.status !== "flagged" && c.verificationScore > 30
  );

  if (trusted.length === 0) return null;

  // Prefer fast chargers first
  const fastChargers = filterFastChargers(trusted);

  if (fastChargers.length > 0) {
    return sortByPowerDescending(fastChargers)[0];
  }

  // Otherwise highest power available
  return sortByPowerDescending(trusted)[0];
}