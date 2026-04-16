import { supabase } from "../../lib/supabase";
import type { UpsertVehicleInput, Vehicle } from "./vehicle.types";

function mapRow(row: Record<string, unknown>): Vehicle {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    name: row.name as string,
    make: row.make as string,
    model: row.model as string,
    year: row.year as number,
    batteryCapacityKWh: Number(row.battery_capacity_kwh),
    maxRangeKm: Number(row.max_range_km),
    efficiencyKWhPer100Km: Number(row.efficiency_kwh_per_100km),
    defaultReservePercent: row.default_reserve_percent as number,
    connectorType: (row.connector_type as string) || "Type2",
    maxChargePowerKw: Number(row.max_charge_power_kw) || 11,
    realWorldEfficiencyKWhPer100Km: row.real_world_efficiency_kwh_per_100km != null
      ? Number(row.real_world_efficiency_kwh_per_100km)
      : null,
    calibrationStatus: (row.calibration_status as Vehicle["calibrationStatus"]) || "uncalibrated",
    createdAtIso: row.created_at as string,
    updatedAtIso: row.updated_at as string,
  };
}

export async function upsertVehicle(
  vehicleId: string | null,
  userId: string,
  payload: UpsertVehicleInput
): Promise<string> {
  const row = {
    ...(vehicleId ? { id: vehicleId } : {}),
    user_id: userId,
    name: payload.name,
    make: payload.make,
    model: payload.model,
    year: payload.year,
    battery_capacity_kwh: payload.batteryCapacityKWh,
    max_range_km: payload.maxRangeKm,
    efficiency_kwh_per_100km: payload.efficiencyKWhPer100Km,
    default_reserve_percent: payload.defaultReservePercent,
    connector_type: payload.connectorType,
    max_charge_power_kw: payload.maxChargePowerKw,
  };

  const { data, error } = await supabase
    .from("vehicles")
    .upsert(row)
    .select("id")
    .single();
  if (error) throw error;
  return (data as { id: string }).id;
}

export async function listVehiclesByUser(userId: string): Promise<Vehicle[]> {
  const { data, error } = await supabase
    .from("vehicles")
    .select("*")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return (data as Record<string, unknown>[]).map(mapRow);
}

export async function deleteVehicle(vehicleId: string): Promise<void> {
  const { error } = await supabase.from("vehicles").delete().eq("id", vehicleId);
  if (error) throw error;
}
