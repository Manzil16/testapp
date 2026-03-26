import { supabase } from "../../lib/supabase";
import { AppConfig } from "../../constants/app";
import { reconcileAndCapture } from "../../services/stripeService";
import { getVerificationGate } from "../verification/verification-gates.repository";
import type { Booking, BookingStatus, CreateBookingInput } from "./booking.types";

function mapRow(row: Record<string, unknown>): Booking {
  const createdAt = row.created_at as string;
  let effectiveStatus = row.status as BookingStatus;

  // Auto-expire: if still "requested" and past expiry
  if (effectiveStatus === "requested" && row.expires_at) {
    if (Date.now() > new Date(row.expires_at as string).getTime()) {
      effectiveStatus = "expired";
    }
  }

  return {
    id: row.id as string,
    chargerId: row.charger_id as string,
    driverUserId: row.driver_id as string,
    hostUserId: row.host_id as string,
    startTimeIso: row.start_time as string,
    endTimeIso: row.end_time as string,
    estimatedKWh: Number(row.estimated_kwh),
    subtotalAmount: Number(row.subtotal_amount ?? row.total_amount),
    totalAmount: Number(row.total_amount),
    platformFee: Number(row.platform_fee),
    note: effectiveStatus !== (row.status as string) ? "Expired — host did not respond" : (row.note as string),
    status: effectiveStatus,
    arrivalSignal: row.arrival_signal as Booking["arrivalSignal"],
    expiresAtIso: (row.expires_at as string) || undefined,
    graceExpiresAtIso: (row.grace_expires_at as string) || undefined,
    actualKWh: row.actual_kwh != null ? Number(row.actual_kwh) : undefined,
    actualAmount: row.actual_amount != null ? Number(row.actual_amount) : undefined,
    sessionStartedAtIso: (row.session_started_at as string) || undefined,
    sessionEndedAtIso: (row.session_ended_at as string) || undefined,
    cancellationReason: (row.cancellation_reason as string) || undefined,
    hostPayoutAmount: row.host_payout_amount != null ? Number(row.host_payout_amount) : undefined,
    stripePaymentIntentId: (row.stripe_payment_intent_id as string) || undefined,
    paymentStatus: (row.payment_status as string) || undefined,
    cancelledAtIso: (row.cancelled_at as string) || undefined,
    createdAtIso: createdAt,
    updatedAtIso: row.updated_at as string,
  };
}

export type BookingCreateResult =
  | { success: true; bookingId: string }
  | { conflict: true }
  | { unverified: true; missing: { emailVerified: boolean; phoneVerified: boolean; paymentAdded: boolean } }
  | { error: string };

export async function createBookingRequest(input: CreateBookingInput): Promise<BookingCreateResult> {
  // Gate 1: driver must be verified
  const gate = await getVerificationGate(input.driverUserId);
  if (!gate?.driverCleared) {
    return {
      unverified: true,
      missing: {
        emailVerified: gate?.emailVerified ?? false,
        phoneVerified: gate?.phoneVerified ?? false,
        paymentAdded: gate?.paymentMethodAdded ?? false,
      },
    };
  }

  const startDate = new Date(input.startTimeIso);
  const endDate = new Date(input.endTimeIso);

  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime()) || endDate <= startDate) {
    return { error: "Booking time range is invalid." };
  }

  // Check for overlapping bookings on the same charger
  const { count: overlapCount } = await supabase
    .from("bookings")
    .select("id", { count: "exact", head: true })
    .eq("charger_id", input.chargerId)
    .in("status", ["requested", "approved", "active"])
    .lt("start_time", input.endTimeIso)
    .gt("end_time", input.startTimeIso);

  if (overlapCount && overlapCount > 0) {
    return { conflict: true };
  }

  // Calculate amounts
  const charger = await supabase
    .from("chargers")
    .select("price_per_kwh, host_id")
    .eq("id", input.chargerId)
    .single();

  if (charger.error) return { error: "Selected charger could not be found." };

  const pricePerKwh = Number(charger.data.price_per_kwh);
  const subtotalAmount = pricePerKwh * input.estimatedKWh;
  const platformFee = subtotalAmount * (AppConfig.PLATFORM_FEE_PERCENT / 100);
  const driverTotal = subtotalAmount + platformFee;
  const expiresAt = new Date(Date.now() + AppConfig.BOOKING_EXPIRY_MS).toISOString();

  try {
    const { data, error } = await supabase
      .from("bookings")
      .insert({
        charger_id: input.chargerId,
        driver_id: input.driverUserId,
        host_id: input.hostUserId,
        start_time: input.startTimeIso,
        end_time: input.endTimeIso,
        estimated_kwh: input.estimatedKWh,
        subtotal_amount: subtotalAmount,
        total_amount: driverTotal,
        platform_fee: platformFee,
        note: input.note || "",
        status: "requested",
        arrival_signal: "en_route",
        expires_at: expiresAt,
      })
      .select("id")
      .single();

    if (error?.code === "23P01") return { conflict: true };
    if (error) return { error: error.message };
    return { success: true, bookingId: (data as { id: string }).id };
  } catch (e: unknown) {
    return { error: e instanceof Error ? e.message : "Unknown error" };
  }
}

export async function listBookingsByDriver(driverUserId: string): Promise<Booking[]> {
  const { data, error } = await supabase
    .from("bookings")
    .select("*")
    .eq("driver_id", driverUserId)
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return (data as Record<string, unknown>[]).map(mapRow);
}

export async function listBookingsByHost(hostUserId: string): Promise<Booking[]> {
  const { data, error } = await supabase
    .from("bookings")
    .select("*")
    .eq("host_id", hostUserId)
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return (data as Record<string, unknown>[]).map(mapRow);
}

export async function updateBookingStatus(
  bookingId: string,
  status: BookingStatus,
  note?: string,
  cancellationReason?: string
): Promise<void> {
  const update: Record<string, unknown> = { status };
  if (note !== undefined) update.note = note;
  if (cancellationReason !== undefined) update.cancellation_reason = cancellationReason;
  if (status === "cancelled") update.cancelled_at = new Date().toISOString();

  const { error } = await supabase.from("bookings").update(update).eq("id", bookingId);
  if (error) throw error;
}

export async function listAllBookings(): Promise<Booking[]> {
  const { data, error } = await supabase
    .from("bookings")
    .select("*")
    .order("updated_at", { ascending: false })
    .limit(250);
  if (error) throw error;
  return (data as Record<string, unknown>[]).map(mapRow);
}

export async function updateArrivalSignal(
  bookingId: string,
  signal: Booking["arrivalSignal"]
): Promise<void> {
  const update: Record<string, unknown> = { arrival_signal: signal };
  if (signal === "arrived") {
    update.session_started_at = new Date().toISOString();
  }
  const { error } = await supabase
    .from("bookings")
    .update(update)
    .eq("id", bookingId);
  if (error) throw error;
}

/**
 * End a charging session — reconciles actual kWh with Stripe and completes the booking.
 */
export async function endSession(
  bookingId: string,
  actualKwh: number
): Promise<void> {
  await reconcileAndCapture(bookingId, actualKwh);
}

/**
 * Get a single booking by ID with charger details.
 */
export async function getBookingById(bookingId: string): Promise<Booking | null> {
  const { data, error } = await supabase
    .from("bookings")
    .select("*")
    .eq("id", bookingId)
    .single();
  if (error) {
    if (error.code === "PGRST116") return null;
    throw error;
  }
  return mapRow(data as Record<string, unknown>);
}
