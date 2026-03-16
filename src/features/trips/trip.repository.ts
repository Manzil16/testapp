import { supabase } from "../../lib/supabase";
import type { Json } from "../../lib/database.types";
import type { CreateTripInput, Trip, TripPoint } from "./trip.types";

function mapRow(row: Record<string, unknown>): Trip {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    origin: row.origin as TripPoint,
    destination: row.destination as TripPoint,
    currentBatteryPercent: Number(row.current_battery_percent),
    vehicleMaxRangeKm: Number(row.vehicle_max_range_km),
    distanceKm: Number(row.distance_km),
    durationMinutes: Number(row.duration_minutes),
    routePolyline: row.route_polyline as string,
    projectedArrivalPercent: Number(row.projected_arrival_percent),
    recommendedChargerId: (row.recommended_charger_id as string) || undefined,
    createdAtIso: row.created_at as string,
    updatedAtIso: row.updated_at as string,
  };
}

export async function createTrip(input: CreateTripInput): Promise<string> {
  const { data, error } = await supabase
    .from("trips")
    .insert({
      user_id: input.userId,
      origin: input.origin as unknown as Json,
      destination: input.destination as unknown as Json,
      current_battery_percent: input.currentBatteryPercent,
      vehicle_max_range_km: input.vehicleMaxRangeKm,
      distance_km: input.distanceKm,
      duration_minutes: input.durationMinutes,
      route_polyline: input.routePolyline,
      projected_arrival_percent: input.projectedArrivalPercent,
      recommended_charger_id: input.recommendedChargerId || null,
    })
    .select("id")
    .single();
  if (error) throw error;
  return (data as { id: string }).id;
}

export async function getTripById(tripId: string): Promise<Trip | null> {
  const { data, error } = await supabase
    .from("trips")
    .select("*")
    .eq("id", tripId)
    .single();
  if (error) {
    if (error.code === "PGRST116") return null;
    throw error;
  }
  return mapRow(data as Record<string, unknown>);
}

export async function listTripsByUser(userId: string): Promise<Trip[]> {
  const { data, error } = await supabase
    .from("trips")
    .select("*")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return (data as Record<string, unknown>[]).map(mapRow);
}
