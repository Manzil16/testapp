import { supabase } from "../../lib/supabase";
import type { CreateReviewInput, Review } from "./review.types";

function mapRow(row: Record<string, unknown>): Review {
  return {
    id: row.id as string,
    bookingId: row.booking_id as string,
    chargerId: row.charger_id as string,
    driverUserId: row.driver_id as string,
    hostUserId: row.host_id as string,
    rating: Number(row.rating),
    comment: (row.comment as string) || "",
    createdAtIso: row.created_at as string,
  };
}

export async function createReview(input: CreateReviewInput): Promise<string> {
  const { data, error } = await supabase
    .from("reviews")
    .insert({
      booking_id: input.bookingId,
      charger_id: input.chargerId,
      driver_id: input.driverUserId,
      host_id: input.hostUserId,
      rating: input.rating,
      comment: input.comment || "",
    })
    .select("id")
    .single();
  if (error) throw error;
  return (data as { id: string }).id;
}

export async function listReviewsByCharger(chargerId: string): Promise<Review[]> {
  const { data, error } = await supabase
    .from("reviews")
    .select("*")
    .eq("charger_id", chargerId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data as Record<string, unknown>[]).map(mapRow);
}

export async function listReviewsByDriver(driverUserId: string): Promise<Review[]> {
  const { data, error } = await supabase
    .from("reviews")
    .select("*")
    .eq("driver_id", driverUserId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data as Record<string, unknown>[]).map(mapRow);
}
