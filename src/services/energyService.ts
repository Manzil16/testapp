import type { TripInput, TripResult } from "../models/Trip";
import {
  BATTERY_PERCENT_MAX,
  BATTERY_PERCENT_MIN,
} from "../utils/constants";

export interface TripCalculationSnapshot {
  input: TripInput;
  result: TripResult;
  calculatedAtIso: string;
}

let lastTripCalculation: TripCalculationSnapshot | null = null;

function clampPercent(value: number): number {
  return Math.min(BATTERY_PERCENT_MAX, Math.max(BATTERY_PERCENT_MIN, value));
}

export function calculateEnergyRequired(
  distanceKm: number,
  efficiencyKWhPer100Km: number
): number {
  return (distanceKm / 100) * efficiencyKWhPer100Km;
}

export function calculateArrivalBattery(
  currentBatteryPercent: number,
  energyRequired: number,
  batteryCapacityKWh: number
): number {
  if (batteryCapacityKWh <= 0) {
    return BATTERY_PERCENT_MIN;
  }

  const batteryUsedPercent = (energyRequired / batteryCapacityKWh) * 100;
  const arrivalBattery = currentBatteryPercent - batteryUsedPercent;

  return clampPercent(arrivalBattery);
}

export function isChargingRequired(
  arrivalBattery: number,
  safetyReservePercent: number
): boolean {
  return arrivalBattery < safetyReservePercent;
}

export function calculateTripResult(input: TripInput): TripResult {
  const energyRequired = calculateEnergyRequired(
    input.distanceKm,
    input.efficiencyKWhPer100Km
  );
  const arrivalBattery = calculateArrivalBattery(
    input.currentBatteryPercent,
    energyRequired,
    input.batteryCapacityKWh
  );
  const needsCharging = isChargingRequired(
    arrivalBattery,
    input.safetyReservePercent
  );

  const result: TripResult = {
    energyRequired,
    arrivalBattery,
    needsCharging,
  };

  lastTripCalculation = {
    input,
    result,
    calculatedAtIso: new Date().toISOString(),
  };

  return result;
}

export function getLastTripCalculation(): TripCalculationSnapshot | null {
  return lastTripCalculation;
}
