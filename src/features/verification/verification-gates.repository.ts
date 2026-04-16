import { supabase } from "../../lib/supabase";
import type { VerificationGate, VerificationGatePatch } from "./verification-gates.types";

function isMissingGateError(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;

  return (
    error.code === "PGRST116" ||
    error.code === "PGRST205" ||
    error.code === "42P01" ||
    error.message?.toLowerCase().includes("verification_gates") === true
  );
}

function mapRow(row: Record<string, unknown>): VerificationGate {
  return {
    userId: row.user_id as string,
    emailVerified: row.email_verified as boolean,
    phoneVerified: row.phone_verified as boolean,
    paymentMethodAdded: row.payment_method_added as boolean,
    idVerified: row.id_verified as boolean,
    idDocumentUrl: (row.id_document_url as string) || undefined,
    stripeOnboarded: row.stripe_onboarded as boolean,
    stripeIdentitySessionId: (row.stripe_identity_session_id as string) || undefined,
    driverCleared: row.driver_cleared as boolean,
    hostCleared: row.host_cleared as boolean,
    createdAtIso: row.created_at as string,
    updatedAtIso: row.updated_at as string,
  };
}

export async function getVerificationGate(
  userId: string
): Promise<VerificationGate | null> {
  const { data, error } = await supabase
    .from("verification_gates")
    .select("*")
    .eq("user_id", userId)
    .single();

  if (error) {
    if (isMissingGateError(error)) return null;
    throw error;
  }
  return mapRow(data as Record<string, unknown>);
}

export async function upsertVerificationGate(
  userId: string,
  patch: VerificationGatePatch
): Promise<void> {
  const row: Record<string, unknown> = {
    user_id: userId,
    updated_at: new Date().toISOString(),
  };
  if (patch.emailVerified !== undefined) row.email_verified = patch.emailVerified;
  if (patch.phoneVerified !== undefined) row.phone_verified = patch.phoneVerified;
  if (patch.paymentMethodAdded !== undefined) row.payment_method_added = patch.paymentMethodAdded;
  if (patch.idVerified !== undefined) row.id_verified = patch.idVerified;
  if (patch.idDocumentUrl !== undefined) row.id_document_url = patch.idDocumentUrl;
  if (patch.stripeOnboarded !== undefined) row.stripe_onboarded = patch.stripeOnboarded;
  if (patch.stripeIdentitySessionId !== undefined)
    row.stripe_identity_session_id = patch.stripeIdentitySessionId;

  const { error } = await supabase
    .from("verification_gates")
    .upsert(row, { onConflict: "user_id" });
  if (error) throw error;
}

export async function isDriverCleared(userId: string): Promise<boolean> {
  const gate = await getVerificationGate(userId);
  return gate?.driverCleared ?? false;
}

export async function isHostCleared(userId: string): Promise<boolean> {
  const gate = await getVerificationGate(userId);
  return gate?.hostCleared ?? false;
}
