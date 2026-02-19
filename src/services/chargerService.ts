import type { Charger } from "../models/Charger";
import { isFastCharger } from "../models/Charger";
import { ChargerType } from "../types/enums";
import { DEFAULT_RESERVE_PERCENT } from "../utils/constants";

export const MOCK_CHARGERS: Charger[] = [
  {
    id: "ch-1",
    name: "Downtown Ultra Fast",
    power: 240,
    type: ChargerType.FAST,
    distanceKm: 1.4,
  },
  {
    id: "ch-2",
    name: "Ring Road Fast Hub",
    power: 180,
    type: ChargerType.FAST,
    distanceKm: 0.9,
  },
  {
    id: "ch-3",
    name: "Mall Normal Charger",
    power: 60,
    type: ChargerType.NORMAL,
    distanceKm: 0.5,
  },
  {
    id: "ch-4",
    name: "Airport Supercharger",
    power: 300,
    type: ChargerType.FAST,
    distanceKm: 3.2,
  },
];

function sortByPowerDescending(chargers: Charger[]): Charger[] {
  return [...chargers].sort((a, b) => b.power - a.power);
}

function sortFastChargersByDistance(chargers: Charger[]): Charger[] {
  return [...chargers]
    .filter(isFastCharger)
    .sort((a, b) => a.distanceKm - b.distanceKm || b.power - a.power);
}

export function recommendCharger(
  arrivalBattery: number,
  chargerList: Charger[],
  safetyReservePercent: number = DEFAULT_RESERVE_PERCENT
): Charger | null {
  const rankedByPower = sortByPowerDescending(chargerList);

  if (arrivalBattery >= safetyReservePercent) {
    return null;
  }

  const nearestFastChargers = sortFastChargersByDistance(rankedByPower);
  if (nearestFastChargers.length > 0) {
    return nearestFastChargers[0];
  }

  return rankedByPower[0] ?? null;
}
