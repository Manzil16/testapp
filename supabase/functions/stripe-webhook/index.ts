// Supabase Edge Function: Stripe Webhook Handler
// Verifies webhook signatures and updates booking payment_status based on Stripe events.
// payment_intent.succeeded performs amount validation before marking captured.

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.10.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
  apiVersion: "2023-10-16",
});

const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET")!;
const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

serve(async (req) => {
  const body = await req.text();
  const signature = req.headers.get("stripe-signature");

  if (!signature) {
    return new Response(
      JSON.stringify({ error: "Missing stripe-signature header" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    return new Response(
      JSON.stringify({ error: `Webhook signature verification failed: ${err.message}` }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  switch (event.type) {
    case "payment_intent.succeeded": {
      const pi = event.data.object as Stripe.PaymentIntent;

      // Fetch the booking to validate that the captured amount matches what we expect
      const { data: booking, error: fetchError } = await supabase
        .from("bookings")
        .select("id, total_amount, driver_id, host_id, status")
        .eq("stripe_payment_intent_id", pi.id)
        .single();

      if (fetchError || !booking) {
        // No booking found — log and acknowledge so Stripe doesn't retry
        console.error("[webhook] payment_intent.succeeded: no booking for pi", pi.id);
        break;
      }

      // Stripe amount_received is in cents; total_amount stored in dollars
      const expectedCents = Math.round(Number(booking.total_amount) * 100);
      const receivedCents = pi.amount_received;

      if (receivedCents === expectedCents) {
        // Amounts match — mark payment captured
        await supabase
          .from("bookings")
          .update({ payment_status: "captured" })
          .eq("id", booking.id);
      } else {
        // Amount mismatch — flag booking for manual review, do NOT mark captured
        console.warn(
          `[webhook] Amount mismatch for booking ${booking.id}: ` +
          `expected ${expectedCents}¢, received ${receivedCents}¢`
        );

        await supabase
          .from("bookings")
          .update({
            status: "flagged_for_review",
            payment_status: "flagged_for_review",
          })
          .eq("id", booking.id);

        await supabase.from("platform_events").insert({
          event_type: "payment.amount_mismatch",
          actor_role: "system",
          target_type: "booking",
          target_id: booking.id,
          amount_cents: receivedCents,
          metadata: {
            booking_id: booking.id,
            driver_id: booking.driver_id,
            host_id: booking.host_id,
            stripe_payment_intent_id: pi.id,
            expected_cents: expectedCents,
            received_cents: receivedCents,
            total_amount_dollars: booking.total_amount,
            prior_status: booking.status,
          },
        });
      }
      break;
    }

    case "payment_intent.payment_failed": {
      const pi = event.data.object as Stripe.PaymentIntent;
      await supabase
        .from("bookings")
        .update({ payment_status: "failed", status: "cancelled" })
        .eq("stripe_payment_intent_id", pi.id);
      break;
    }

    case "payment_intent.canceled": {
      const pi = event.data.object as Stripe.PaymentIntent;
      await supabase
        .from("bookings")
        .update({ payment_status: "cancelled" })
        .eq("stripe_payment_intent_id", pi.id);
      break;
    }

    case "charge.refunded": {
      const charge = event.data.object as Stripe.Charge;
      if (charge.payment_intent) {
        await supabase
          .from("bookings")
          .update({ payment_status: "refunded" })
          .eq("stripe_payment_intent_id", charge.payment_intent as string);
      }
      break;
    }

    default:
      // Unhandled event type — acknowledge receipt
      break;
  }

  return new Response(
    JSON.stringify({ received: true }),
    { headers: { "Content-Type": "application/json" } }
  );
});
