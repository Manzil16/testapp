import Stripe from "npm:stripe@14.10.0";
import { createClient } from "npm:@supabase/supabase-js@2.39.0";
import { sendPushNotification } from "../_shared/push-notifications.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const stripeKey = Deno.env.get("STRIPE_SECRET_KEY")!;

  try {
    const { bookingId, actualKwh } = await req.json();

    if (!bookingId || actualKwh === undefined || actualKwh === null) {
      return new Response(
        JSON.stringify({ error: "bookingId and actualKwh are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: booking, error: bookingError } = await supabase
      .from("bookings")
      .select("*, charger:chargers(pricing_per_kwh)")
      .eq("id", bookingId)
      .single();

    if (bookingError || !booking) {
      return new Response(
        JSON.stringify({ error: "Booking not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!booking.stripe_payment_intent_id) {
      return new Response(
        JSON.stringify({ error: "No payment intent associated with this booking" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const [{ data: feeConfig, error: feeError }, { data: hostFeeConfig, error: hostFeeError }] =
      await Promise.all([
        supabase.from("platform_config").select("value").eq("key", "platform_fee_percent").single(),
        supabase.from("platform_config").select("value").eq("key", "host_fee_percent").single(),
      ]);

    if (feeError || !feeConfig || hostFeeError || !hostFeeConfig) {
      return new Response(
        JSON.stringify({ error: "Platform fee configuration unavailable." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const platformFeePercent = parseFloat(feeConfig.value);
    const hostFeePercent = parseFloat(hostFeeConfig.value);

    const pricePerKwh = parseFloat(booking.charger.pricing_per_kwh);
    const actualSubtotal = actualKwh * pricePerKwh;
    const platformFee = actualSubtotal * (platformFeePercent / 100);
    const actualTotal = actualSubtotal + platformFee;
    const hostPayout = actualSubtotal * (1 - hostFeePercent / 100);
    const amountCents = Math.round(actualTotal * 100);

    const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" });
    await stripe.paymentIntents.capture(
      booking.stripe_payment_intent_id,
      { amount_to_capture: amountCents }
    );

    // Stripe capture succeeded — DB write must also succeed or the booking stays
    // stuck in "active" with money already taken. Return 500 so the client retries;
    // re-calling this endpoint is safe because the capture has an idempotency key.
    const { error: updateError } = await supabase.from("bookings").update({
      actual_kwh: actualKwh,
      actual_amount: actualTotal,
      host_payout_amount: hostPayout,
      status: "completed",
      session_ended_at: new Date().toISOString(),
    }).eq("id", bookingId);

    if (updateError) {
      return new Response(
        JSON.stringify({ error: "Payment captured but booking update failed. Contact support with booking ID." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    if (booking.driver_id) {
      await sendPushNotification(supabaseUrl, supabaseServiceKey, booking.driver_id,
        "Session Complete",
        `Charging session finished. ${actualKwh.toFixed(1)} kWh used — $${actualTotal.toFixed(2)} charged.`,
        { bookingId, screen: "booking-detail" }
      );
    }

    if (booking.host_id) {
      await sendPushNotification(supabaseUrl, supabaseServiceKey, booking.host_id,
        "Session Complete — Payout Incoming",
        `Charging session finished. You'll receive $${hostPayout.toFixed(2)} for ${actualKwh.toFixed(1)} kWh delivered.`,
        { bookingId, screen: "host-booking-detail" }
      );
    }

    await supabase.from("platform_events").insert({
      event_type: "payment.captured",
      actor_role: "system",
      target_type: "booking",
      target_id: bookingId,
      amount_cents: amountCents,
      kwh: actualKwh,
      metadata: {
        booking_id: bookingId,
        driver_id: booking.driver_id,
        host_id: booking.host_id,
        actual_kwh: actualKwh,
        actual_amount: actualTotal,
        host_payout: hostPayout,
        platform_fee: platformFee,
        price_per_kwh: pricePerKwh,
        stripe_payment_intent: booking.stripe_payment_intent_id,
      },
    });

    return new Response(
      JSON.stringify({ ok: true, actualTotal: Math.round(actualTotal * 100) / 100, hostPayout: Math.round(hostPayout * 100) / 100 }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Failed to reconcile payment" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
