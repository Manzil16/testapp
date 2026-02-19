export interface TripInput {
  currentBatteryPercent: number;
  efficiencyKWhPer100Km: number;
  batteryCapacityKWh: number;
  distanceKm: number;
  safetyReservePercent: number;
}

export interface TripResult {
  energyRequired: number;
  arrivalBattery: number;
  needsCharging: boolean;
}
