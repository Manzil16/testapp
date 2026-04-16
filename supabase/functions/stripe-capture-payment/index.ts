import { createClient } from "npm:@supabase/supabase-js@2.39.0";
import { sendPushNotification } from "../_shared/push-notifications.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// This function is called when a host APPROVES a booking.
// It does NOT capture the Stripe PaymentIntent — the hold is kept as-is.
// Actual capture (for real kWh used) happens in stripe-reconcile-payment
// when the session ends.
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
  if (!stripeKey) {
    return new Response(
      JSON.stringify({ stripeNotConfigured: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const { paymentIntentId } = await req.json();

    if (!paymentIntentId) {
      return new Response(
        JSON.stringify({ error: "paymentIntentId is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Mark hold as authorized — do NOT call stripe.paymentIntents.capture here.
    // The hold stays open until stripe-reconcile-payment fires after session end.
    const { data: booking } = await supabase
      .from("bookings")
      .update({ payment_status: "authorized" })
      .eq("stripe_payment_intent_id", paymentIntentId)
      .select("id, driver_id, charger:chargers(name)")
      .single();

    if (booking?.driver_id) {
      const chargerName = (booking.charger as any)?.name ?? "your charger";
      await sendPushNotification(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
        booking.driver_id,
        "Booking Approved!",
        `Your booking at ${chargerName} has been confirmed. You'll only be charged for actual kWh used.`,
        { bookingId: booking.id, screen: "booking-detail" }
      );
    }

    return new Response(
      JSON.stringify({ ok: true, status: "authorized" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Failed to authorize payment" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
