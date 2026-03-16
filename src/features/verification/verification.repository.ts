import { supabase } from "../../lib/supabase";
import type {
  CreateVerificationRequestInput,
  VerificationRequest,
  VerificationStatus,
} from "./verification.types";

function mapRow(row: Record<string, unknown>): VerificationRequest {
  return {
    id: row.id as string,
    chargerId: row.charger_id as string,
    hostUserId: row.host_id as string,
    status: row.status as VerificationStatus,
    note: (row.note as string) || "",
    reviewedByUserId: (row.reviewed_by as string) || undefined,
    createdAtIso: row.created_at as string,
    updatedAtIso: row.updated_at as string,
  };
}

export async function createVerificationRequest(
  input: CreateVerificationRequestInput
): Promise<string> {
  const { data, error } = await supabase
    .from("verification_requests")
    .insert({
      charger_id: input.chargerId,
      host_id: input.hostUserId,
      note: input.note || "",
      status: "pending",
    })
    .select("id")
    .single();
  if (error) throw error;
  return (data as { id: string }).id;
}

export async function listVerificationQueue(): Promise<VerificationRequest[]> {
  const { data, error } = await supabase
    .from("verification_requests")
    .select("*")
    .eq("status", "pending")
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data as Record<string, unknown>[]).map(mapRow);
}

export async function listVerificationRequestsByHost(
  hostUserId: string
): Promise<VerificationRequest[]> {
  const { data, error } = await supabase
    .from("verification_requests")
    .select("*")
    .eq("host_id", hostUserId)
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return (data as Record<string, unknown>[]).map(mapRow);
}

export async function reviewVerificationRequest(input: {
  requestId: string;
  reviewerUserId: string;
  status: VerificationStatus;
  note: string;
}): Promise<void> {
  const { error } = await supabase
    .from("verification_requests")
    .update({
      status: input.status,
      note: input.note,
      reviewed_by: input.reviewerUserId,
    })
    .eq("id", input.requestId);
  if (error) throw error;
}
