import { supabase } from "../../lib/supabase";
import type { Booking, BookingStatus, CreateBookingInput } from "./booking.types";

const BOOKING_EXPIRY_MS = 24 * 60 * 60 * 1000;

function mapRow(row: Record<string, unknown>): Booking {
  const createdAt = row.created_at as string;
  let effectiveStatus = row.status as BookingStatus;

  // Auto-expire: if still "requested" and past expiry
  if (effectiveStatus === "requested" && row.expires_at) {
    if (Date.now() > new Date(row.expires_at as string).getTime()) {
      effectiveStatus = "cancelled";
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
    totalAmount: Number(row.total_amount),
    platformFee: Number(row.platform_fee),
    note: effectiveStatus !== (row.status as string) ? "Expired — host did not respond" : (row.note as string),
    status: effectiveStatus,
    arrivalSignal: row.arrival_signal as Booking["arrivalSignal"],
    expiresAtIso: (row.expires_at as string) || undefined,
    stripePaymentIntentId: (row.stripe_payment_intent_id as string) || undefined,
    createdAtIso: createdAt,
    updatedAtIso: row.updated_at as string,
  };
}

export async function createBookingRequest(input: CreateBookingInput): Promise<string> {
  const startDate = new Date(input.startTimeIso);
  const endDate = new Date(input.endTimeIso);

  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime()) || endDate <= startDate) {
    throw new Error("Booking time range is invalid.");
  }

  // Calculate amounts
  const charger = await supabase
    .from("chargers")
    .select("price_per_kwh, host_id")
    .eq("id", input.chargerId)
    .single();

  if (charger.error) throw new Error("Selected charger could not be found.");

  const pricePerKwh = Number(charger.data.price_per_kwh);
  const totalAmount = pricePerKwh * input.estimatedKWh;
  const platformFee = totalAmount * 0.2;
  const expiresAt = new Date(Date.now() + BOOKING_EXPIRY_MS).toISOString();

  const { data, error } = await supabase
    .from("bookings")
    .insert({
      charger_id: input.chargerId,
      driver_id: input.driverUserId,
      host_id: input.hostUserId,
      start_time: input.startTimeIso,
      end_time: input.endTimeIso,
      estimated_kwh: input.estimatedKWh,
      total_amount: totalAmount,
      platform_fee: platformFee,
      note: input.note || "",
      status: "requested",
      arrival_signal: "en_route",
      expires_at: expiresAt,
    })
    .select("id")
    .single();

  if (error) throw error;
  return (data as { id: string }).id;
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
  note?: string
): Promise<void> {
  const update: Record<string, unknown> = { status };
  if (note !== undefined) update.note = note;

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
  const { error } = await supabase
    .from("bookings")
    .update({ arrival_signal: signal })
    .eq("id", bookingId);
  if (error) throw error;
}
