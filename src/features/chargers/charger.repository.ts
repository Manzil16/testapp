import { supabase } from "../../lib/supabase";
import { AppConfig } from "../../constants/app";
import type { Json } from "../../lib/database.types";
import type {
  Charger,
  ChargerConnector,
  ChargerAvailabilityWindow,
  ChargerFilter,
  ChargerStatus,
  UpsertChargerInput,
} from "./charger.types";

function mapRow(row: Record<string, unknown>): Charger {
  return {
    id: row.id as string,
    hostUserId: row.host_id as string,
    name: row.name as string,
    address: row.address as string,
    suburb: row.suburb as string,
    state: row.state as string,
    latitude: row.latitude as number,
    longitude: row.longitude as number,
    maxPowerKw: row.max_power_kw as number,
    pricingPerKwh: Number(row.price_per_kwh),
    connectors: (row.connectors as ChargerConnector[]) || [],
    amenities: (row.amenities as string[]) || [],
    availabilityNote: (row.availability_note as string) || "",
    availabilityWindow: row.availability_window as ChargerAvailabilityWindow | undefined,
    images: (row.images as string[]) || [],
    status: row.status as ChargerStatus,
    verificationScore: row.verification_score as number,
    createdAtIso: row.created_at as string,
    updatedAtIso: row.updated_at as string,
  };
}

function applyClientFilter(chargers: Charger[], filter?: ChargerFilter): Charger[] {
  if (!filter) return chargers;
  return chargers.filter((c) => {
    if (filter.status && c.status !== filter.status) return false;
    if (filter.state && c.state.toLowerCase() !== filter.state.toLowerCase()) return false;
    if (typeof filter.minPowerKw === "number" && c.maxPowerKw < filter.minPowerKw) return false;
    if (filter.connectorType && !c.connectors.some((cn) => cn.type === filter.connectorType))
      return false;
    if (filter.searchText) {
      const hay = `${c.name} ${c.address} ${c.suburb}`.toLowerCase();
      if (!hay.includes(filter.searchText.trim().toLowerCase())) return false;
    }
    return true;
  });
}

export async function upsertCharger(
  chargerId: string | null,
  hostUserId: string,
  payload: UpsertChargerInput,
  status: ChargerStatus = "pending"
): Promise<string> {
  const row = {
    ...(chargerId ? { id: chargerId } : {}),
    host_id: hostUserId,
    name: payload.name,
    address: payload.address,
    suburb: payload.suburb,
    state: payload.state,
    latitude: payload.latitude,
    longitude: payload.longitude,
    max_power_kw: payload.maxPowerKw,
    price_per_kwh: payload.pricingPerKwh,
    connectors: payload.connectors as unknown as Json,
    amenities: payload.amenities,
    availability_note: payload.availabilityNote,
    availability_window: (payload.availabilityWindow as unknown as Json) ?? null,
    images: payload.images || [],
    status,
    verification_score: status === "approved" ? AppConfig.VERIFICATION.defaultApprovedScore : AppConfig.VERIFICATION.defaultPendingScore,
  };

  const { data, error } = await supabase
    .from("chargers")
    .upsert(row)
    .select("id")
    .single();
  if (error) throw error;
  return (data as { id: string }).id;
}

export async function getChargerById(chargerId: string): Promise<Charger | null> {
  const { data, error } = await supabase
    .from("chargers")
    .select("*")
    .eq("id", chargerId)
    .single();
  if (error) {
    if (error.code === "PGRST116") return null;
    throw error;
  }
  return mapRow(data as Record<string, unknown>);
}

export async function listChargers(filter?: ChargerFilter): Promise<Charger[]> {
  let q = supabase.from("chargers").select("*").order("updated_at", { ascending: false });

  if (filter?.status) {
    q = q.eq("status", filter.status);
  }

  const { data, error } = await q;
  if (error) throw error;
  return applyClientFilter(
    (data as Record<string, unknown>[]).map(mapRow),
    filter
  );
}

export async function listChargersByHost(hostUserId: string): Promise<Charger[]> {
  const { data, error } = await supabase
    .from("chargers")
    .select("*")
    .eq("host_id", hostUserId)
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return (data as Record<string, unknown>[]).map(mapRow);
}

export interface VerificationRubric {
  photoQuality: number;      // 0, 10, or 20
  plugVerified: 0 | 20;      // confirmed plug type
  locationAccuracy: number;  // 0, 10, or 20
  hostResponse: number;      // 0-20 auto-calculated
  adminReview: 0 | 20;       // admin discretion
}

export async function updateChargerStatus(
  chargerId: string,
  status: ChargerStatus,
  verificationScore: number,
  rubric?: VerificationRubric
): Promise<void> {
  const update: Record<string, unknown> = { status, verification_score: verificationScore };
  if (rubric) {
    update.rubric_photo_quality = rubric.photoQuality;
    update.rubric_plug_verified = rubric.plugVerified;
    update.rubric_location_accuracy = rubric.locationAccuracy;
    update.rubric_host_response = rubric.hostResponse;
    update.rubric_admin_review = rubric.adminReview;
  }

  const { error } = await supabase
    .from("chargers")
    .update(update)
    .eq("id", chargerId);
  if (error) throw error;
}

export async function deleteCharger(chargerId: string): Promise<void> {
  const { error } = await supabase.from("chargers").delete().eq("id", chargerId);
  if (error) throw error;
}

export interface MapBounds {
  south: number;
  north: number;
  west: number;
  east: number;
}

export async function listChargersInBounds(bounds: MapBounds, maxResults = 200): Promise<Charger[]> {
  const { data, error } = await supabase.rpc("chargers_in_bounds", {
    min_lat: bounds.south,
    max_lat: bounds.north,
    min_lng: bounds.west,
    max_lng: bounds.east,
    max_results: maxResults,
  });
  if (error) throw error;
  return (data as Record<string, unknown>[]).map(mapRow);
}
