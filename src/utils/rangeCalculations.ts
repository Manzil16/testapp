export function calculateCurrentRange(
  batteryPercent: number,
  vehicleMaxRange: number
): number {
  return (vehicleMaxRange * batteryPercent) / 100;
}

export function calculateRangeAfterTrip(
  currentRange: number,
  distance: number
): number {
  return currentRange - distance;
}

export function calculatePercentAfterTrip(
  rangeAfter: number,
  vehicleMaxRange: number
): number {
  return (rangeAfter / vehicleMaxRange) * 100;
}

export type RangeStatus = "can-reach" | "low-margin" | "cannot-reach";

export function getRangeStatus(
  rangeAfter: number,
  percentAfter: number
): RangeStatus {
  if (rangeAfter < 0) return "cannot-reach";
  if (percentAfter < 20) return "low-margin";
  return "can-reach";
}
