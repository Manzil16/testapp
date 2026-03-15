export interface Vehicle {
  id: string;
  userId: string;
  name: string;
  make: string;
  model: string;
  year: number;
  batteryCapacityKWh: number;
  maxRangeKm: number;
  efficiencyKWhPer100Km: number;
  defaultReservePercent: number;
  createdAtIso: string;
  updatedAtIso: string;
}

export interface UpsertVehicleInput {
  name: string;
  make: string;
  model: string;
  year: number;
  batteryCapacityKWh: number;
  maxRangeKm: number;
  efficiencyKWhPer100Km: number;
  defaultReservePercent: number;
}
