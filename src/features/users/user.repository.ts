import { supabase } from "../../lib/supabase";
import type { AppRole, UpsertUserProfileInput, UserProfile } from "./user.types";

function mapRow(row: Record<string, unknown>): UserProfile {
  const role = row.role as AppRole;
  return {
    id: row.id as string,
    email: row.email as string,
    displayName: row.display_name as string,
    role,
    isDriver: role === "driver",
    isHost: role === "host",
    isAdmin: role === "admin",
    isSuspended: (row.is_suspended as boolean) ?? false,
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
    is_driver: payload.isDriver ?? (payload.role === "driver"),
    is_host: payload.isHost ?? (payload.role === "host"),
    is_admin: payload.role === "admin",
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

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  hasMore: boolean;
}

export async function listAllProfiles(options?: {
  page?: number;
  pageSize?: number;
  search?: string;
}): Promise<PaginatedResult<UserProfile>> {
  const page = options?.page ?? 0;
  const pageSize = options?.pageSize ?? 50;
  const search = options?.search?.trim();

  let query = supabase
    .from("profiles")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(page * pageSize, (page + 1) * pageSize - 1);

  if (search) {
    query = query.or(
      `display_name.ilike.%${search}%,email.ilike.%${search}%`
    );
  }

  const { data, error, count } = await query;
  if (error) throw error;

  const total = count ?? 0;
  return {
    items: (data as Record<string, unknown>[]).map(mapRow),
    total,
    hasMore: (page + 1) * pageSize < total,
  };
}

export async function deleteProfile(userId: string): Promise<void> {
  const { error } = await supabase.from("profiles").delete().eq("id", userId);
  if (error) throw error;
}

export async function suspendUser(userId: string, suspended: boolean): Promise<void> {
  const { error } = await supabase
    .from("profiles")
    .update({ is_suspended: suspended })
    .eq("id", userId);
  if (error) throw error;
}
