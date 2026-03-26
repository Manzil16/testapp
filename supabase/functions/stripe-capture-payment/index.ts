// Supabase Edge Function: Capture Payment
// Captures a previously authorized PaymentIntent when host approves a booking.

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.10.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import { sendPushNotification } from "../_shared/push-notifications.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
  apiVersion: "2023-10-16",
});

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { paymentIntentId } = await req.json();

    if (!paymentIntentId) {
      return new Response(
        JSON.stringify({ error: "paymentIntentId is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Capture the authorized payment
    const paymentIntent = await stripe.paymentIntents.capture(paymentIntentId);

    // Update booking payment status
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { data: booking } = await supabase
      .from("bookings")
      .update({ payment_status: "captured" })
      .eq("stripe_payment_intent_id", paymentIntentId)
      .select("id, driver_id, charger:chargers(name)")
      .single();

    // Notify the driver that their booking was approved and payment captured
    if (booking?.driver_id) {
      const chargerName = (booking.charger as any)?.name ?? "your charger";
      await sendPushNotification(
        supabaseUrl,
        supabaseServiceKey,
        booking.driver_id,
        "Booking Approved!",
        `Your booking at ${chargerName} has been confirmed and payment authorized.`,
        { bookingId: booking.id, screen: "booking-detail" }
      );
    }

    return new Response(
      JSON.stringify({ status: paymentIntent.status }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message || "Failed to capture payment" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
