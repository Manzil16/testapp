import { supabase } from "../../lib/supabase";
import type { AppRole, UpsertUserProfileInput, UserProfile } from "./user.types";

function mapRow(row: Record<string, unknown>): UserProfile {
  return {
    id: row.id as string,
    email: row.email as string,
    displayName: row.display_name as string,
    role: row.role as AppRole,
    phone: (row.phone as string) || undefined,
    avatarUrl: (row.avatar_url as string) || undefined,
    preferredReservePercent: row.preferred_reserve_percent as number,
    stripeAccountId: (row.stripe_account_id as string) || undefined,
    createdAtIso: row.created_at as string,
    updatedAtIso: row.updated_at as string,
  };
}

export async function upsertUserProfile(
  userId: string,
  payload: UpsertUserProfileInput
): Promise<void> {
  const { error } = await supabase.from("profiles").upsert({
    id: userId,
    email: payload.email,
    display_name: payload.displayName,
    role: payload.role,
    phone: payload.phone || null,
    preferred_reserve_percent: payload.preferredReservePercent ?? 12,
  });
  if (error) throw error;
}

export async function getUserProfile(userId: string): Promise<UserProfile | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single();
  if (error) {
    if (error.code === "PGRST116") return null;
    throw error;
  }
  return mapRow(data as Record<string, unknown>);
}

export async function updateUserProfile(
  userId: string,
  patch: Partial<UpsertUserProfileInput> & { avatarUrl?: string; stripeAccountId?: string }
): Promise<void> {
  const update: Record<string, unknown> = {};
  if (patch.displayName !== undefined) update.display_name = patch.displayName;
  if (patch.email !== undefined) update.email = patch.email;
  if (patch.role !== undefined) update.role = patch.role;
  if (patch.phone !== undefined) update.phone = patch.phone;
  if (patch.preferredReservePercent !== undefined)
    update.preferred_reserve_percent = patch.preferredReservePercent;
  if (patch.avatarUrl !== undefined) update.avatar_url = patch.avatarUrl;
  if (patch.stripeAccountId !== undefined) update.stripe_account_id = patch.stripeAccountId;

  if (Object.keys(update).length === 0) return;

  const { error } = await supabase.from("profiles").update(update).eq("id", userId);
  if (error) throw error;
}

export async function listAllProfiles(): Promise<UserProfile[]> {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(300);
  if (error) throw error;
  return (data as Record<string, unknown>[]).map(mapRow);
}

export async function deleteProfile(userId: string): Promise<void> {
  const { error } = await supabase.from("profiles").delete().eq("id", userId);
  if (error) throw error;
}
