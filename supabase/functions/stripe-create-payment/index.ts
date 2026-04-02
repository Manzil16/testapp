// Supabase Edge Function: Create Payment Intent
// Creates a Stripe PaymentIntent for a booking with platform fee split.
// Fee percentages are ALWAYS read from platform_config — no hardcoded defaults.

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

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const { bookingId, amount, hostStripeAccountId } = await req.json();

    if (!bookingId || !amount) {
      return new Response(
        JSON.stringify({ error: "bookingId and amount are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Read fee percentages from platform_config — never fall back to a hardcoded default.
    // If config is unavailable, reject the operation rather than silently using wrong fees.
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const [{ data: feeData, error: feeError }, { data: hostFeeData, error: hostFeeError }] =
      await Promise.all([
        supabase
          .from("platform_config")
          .select("value")
          .eq("key", "platform_fee_percent")
          .single(),
        supabase
          .from("platform_config")
          .select("value")
          .eq("key", "host_fee_percent")
          .single(),
      ]);

    if (feeError || !feeData || hostFeeError || !hostFeeData) {
      console.error("[stripe-create-payment] platform_config read failed:", feeError, hostFeeError);
      return new Response(
        JSON.stringify({
          error: "Platform fee configuration unavailable. Cannot create payment intent.",
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const platformFeePercent = parseFloat(feeData.value);
    const hostFeePercent = parseFloat(hostFeeData.value);

    if (isNaN(platformFeePercent) || isNaN(hostFeePercent)) {
      return new Response(
        JSON.stringify({ error: "Platform fee configuration contains invalid values." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build PaymentIntent params — only add Connect split if host has a Stripe account
    const intentParams: Record<string, unknown> = {
      amount,
      currency: "aud",
      capture_method: "manual",
      metadata: { bookingId, platform: "vehiclegrid" },
    };

    if (hostStripeAccountId) {
      const guestFeeAmount = Math.round(amount * (platformFeePercent / (100 + platformFeePercent)));
      const hostFeeAmount = Math.round((amount - guestFeeAmount) * (hostFeePercent / 100));
      intentParams.application_fee_amount = guestFeeAmount + hostFeeAmount;
      intentParams.transfer_data = { destination: hostStripeAccountId };
    }

    // Create PaymentIntent with manual capture (authorize now, capture on host approval)
    const paymentIntent = await stripe.paymentIntents.create(
      intentParams as any,
      { idempotencyKey: `payment_create_${bookingId}` }
    );

    // Update booking with payment intent ID
    await supabase
      .from("bookings")
      .update({ stripe_payment_intent_id: paymentIntent.id })
      .eq("id", bookingId);

    return new Response(
      JSON.stringify({
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message || "Failed to create payment intent" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
