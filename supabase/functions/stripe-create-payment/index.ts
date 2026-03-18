// Supabase Edge Function: Create Payment Intent
// Creates a Stripe PaymentIntent for a booking with platform fee split.

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.10.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
  apiVersion: "2023-10-16",
});

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

serve(async (req) => {
  try {
    const { bookingId, amount, hostStripeAccountId, platformFeePercent = 20 } =
      await req.json();

    if (!bookingId || !amount || !hostStripeAccountId) {
      return new Response(
        JSON.stringify({
          error: "bookingId, amount, and hostStripeAccountId are required",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Amount is in cents (e.g., $18.20 = 1820)
    const platformFee = Math.round(amount * (platformFeePercent / 100));

    // Create PaymentIntent with automatic transfer to host
    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency: "aud",
      application_fee_amount: platformFee,
      transfer_data: {
        destination: hostStripeAccountId,
      },
      metadata: {
        bookingId,
        platform: "vehiclegrid",
      },
    });

    // Update booking with payment intent ID
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    await supabase
      .from("bookings")
      .update({ stripe_payment_intent_id: paymentIntent.id })
      .eq("id", bookingId);

    return new Response(
      JSON.stringify({
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
      }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message || "Failed to create payment intent" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
