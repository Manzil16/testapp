export interface Vehicle {
  id: string;
  name: string;
  batteryCapacityKWh: number;
  efficiencyKWhPer100Km: number;
  defaultReservePercent: number;
}

export function buildVehicle(
  batteryCapacityKWh: number,
  efficiencyKWhPer100Km: number,
  defaultReservePercent: number
): Vehicle {
  return {
    id: "vehicle-default",
    name: "VehicleGrid EV",
    batteryCapacityKWh,
    efficiencyKWhPer100Km,
    defaultReservePercent,
  };
}
