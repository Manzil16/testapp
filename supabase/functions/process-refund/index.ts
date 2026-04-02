// Supabase Edge Function: Process Refund
// Refunds a booking payment via Stripe. Enforces 2-hour cancellation window.

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.10.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
  apiVersion: "2023-10-16",
});

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const FREE_CANCELLATION_HOURS = 2;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { bookingId } = await req.json();

    if (!bookingId) {
      return new Response(
        JSON.stringify({ error: "bookingId is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch the booking
    const { data: booking, error: fetchError } = await supabase
      .from("bookings")
      .select("*")
      .eq("id", bookingId)
      .single();

    if (fetchError || !booking) {
      return new Response(
        JSON.stringify({ error: "Booking not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!booking.stripe_payment_intent_id) {
      // No payment to refund — just cancel the booking
      await supabase
        .from("bookings")
        .update({ status: "cancelled", cancelled_at: new Date().toISOString() })
        .eq("id", bookingId);

      return new Response(
        JSON.stringify({ refunded: false, reason: "No payment to refund" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check cancellation window
    const startTime = new Date(booking.start_time);
    const hoursUntilStart = (startTime.getTime() - Date.now()) / (1000 * 60 * 60);

    let refundAmount: number;
    if (hoursUntilStart >= FREE_CANCELLATION_HOURS) {
      // Full refund
      refundAmount = Math.round(booking.total_amount * 100);
    } else {
      // Late cancellation — refund 50% (configurable policy)
      refundAmount = Math.round(booking.total_amount * 100 * 0.5);
    }

    // Issue the refund via Stripe
    await stripe.refunds.create(
      {
        payment_intent: booking.stripe_payment_intent_id,
        amount: refundAmount,
      },
      { idempotencyKey: `refund_${bookingId}` }
    );

    // Update booking status
    await supabase
      .from("bookings")
      .update({
        status: "cancelled",
        payment_status: "refunded",
        cancelled_at: new Date().toISOString(),
      })
      .eq("id", bookingId);

    return new Response(
      JSON.stringify({
        refunded: true,
        refundAmountCents: refundAmount,
        fullRefund: hoursUntilStart >= FREE_CANCELLATION_HOURS,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message || "Failed to process refund" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
