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

/* ===========================
   EXISTING TRIP LOGIC
=========================== */

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

/* ===========================
   NEW REAL-TIME SIMULATION LOGIC
=========================== */

export function calculateRealtimeConsumption(
  speedKmh: number,
  distanceMeters: number,
  gyroData: { x: number; y: number; z: number }
): number {
  const distanceKm = distanceMeters / 1000;

  const baseConsumption = 0.18; // realistic EV avg

  const speedPenalty = speedKmh > 100 ? 0.05 : 0.02;

  const aggressiveFactor =
    Math.abs(gyroData.x) +
    Math.abs(gyroData.y) +
    Math.abs(gyroData.z);

  const aggressivePenalty = aggressiveFactor * 0.005;

  const totalConsumption =
    baseConsumption + speedPenalty + aggressivePenalty;

  return distanceKm * totalConsumption;
}