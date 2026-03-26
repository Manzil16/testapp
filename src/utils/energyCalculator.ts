/**
 * Calculate estimated kWh and cost for a booking.
 * Wall delivery (what gets billed) accounts for charging efficiency losses.
 */
export function calculateBookingEnergy(params: {
  batteryCapacityKwh: number;
  currentBatteryPercent: number;
  targetBatteryPercent: number;
  chargerPowerKw: number;
  pricingPerKwh: number;
  chargingEfficiency?: number; // default 0.90 (AC), 0.95 (DC)
}): {
  estimatedKwh: number;
  estimatedHours: number;
  estimatedCost: number;
} {
  const efficiency = params.chargingEfficiency ?? 0.90;
  const delta =
    (params.targetBatteryPercent - params.currentBatteryPercent) / 100;
  const neededInBattery = delta * params.batteryCapacityKwh;
  const estimatedKwh = neededInBattery / efficiency;
  const estimatedHours = estimatedKwh / params.chargerPowerKw;

  return {
    estimatedKwh: Math.round(estimatedKwh * 10) / 10,
    estimatedHours,
    estimatedCost:
      Math.round(estimatedKwh * params.pricingPerKwh * 100) / 100,
  };
}
