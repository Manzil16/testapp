import type { TripInput } from "../models/Trip";
import {
  BATTERY_PERCENT_MAX,
  BATTERY_PERCENT_MIN,
} from "./constants";

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

interface RangeRule {
  min: number;
  max: number;
  label: string;
}

function validateRange<T extends number>(value: T, rule: RangeRule): string | null {
  if (!Number.isFinite(value)) {
    return `${rule.label} must be a valid number.`;
  }

  if (value < rule.min || value > rule.max) {
    return `${rule.label} must be between ${rule.min} and ${rule.max}.`;
  }

  return null;
}

export function parseNumberInput(value: string): number | null {
  const parsed = Number(value.trim());
  if (!Number.isFinite(parsed)) {
    return null;
  }

  return parsed;
}

export function validateBatteryInput(currentBatteryPercent: number): string | null {
  return validateRange(currentBatteryPercent, {
    min: BATTERY_PERCENT_MIN,
    max: BATTERY_PERCENT_MAX,
    label: "Current battery",
  });
}

export function validateDistance(distanceKm: number): string | null {
  return validateRange(distanceKm, {
    min: 1,
    max: 5000,
    label: "Trip distance",
  });
}

export function validateEfficiency(efficiencyKWhPer100Km: number): string | null {
  return validateRange(efficiencyKWhPer100Km, {
    min: 5,
    max: 60,
    label: "Vehicle efficiency",
  });
}

export function validateBatteryCapacity(batteryCapacityKWh: number): string | null {
  return validateRange(batteryCapacityKWh, {
    min: 20,
    max: 200,
    label: "Battery capacity",
  });
}

export function validateReservePercent(safetyReservePercent: number): string | null {
  return validateRange(safetyReservePercent, {
    min: BATTERY_PERCENT_MIN,
    max: 40,
    label: "Safety reserve",
  });
}

export function validateTripInput(input: TripInput): ValidationResult {
  const maybeErrors: (string | null)[] = [
    validateBatteryInput(input.currentBatteryPercent),
    validateEfficiency(input.efficiencyKWhPer100Km),
    validateBatteryCapacity(input.batteryCapacityKWh),
    validateDistance(input.distanceKm),
    validateReservePercent(input.safetyReservePercent),
  ];

  const errors = maybeErrors.filter((error): error is string => error !== null);

  return {
    valid: errors.length === 0,
    errors,
  };
}
