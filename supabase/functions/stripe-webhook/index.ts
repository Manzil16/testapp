import Stripe from "npm:stripe@14.10.0";
import { createClient } from "npm:@supabase/supabase-js@2.39.0";

Deno.serve(async (req) => {
  const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");

  if (!stripeKey || !webhookSecret) {
    // Consume the body to avoid Stripe retry storms, then return 200.
    await req.text();
    return new Response(
      JSON.stringify({ error: "Stripe not configured on this server" }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  }

  const body = await req.text();
  const signature = req.headers.get("stripe-signature");

  if (!signature) {
    return new Response(
      JSON.stringify({ error: "Missing stripe-signature header" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const stripe = new Stripe(stripeKey!, { apiVersion: "2023-10-16" });

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    return new Response(
      JSON.stringify({ error: `Webhook signature verification failed: ${err instanceof Error ? err.message : "error"}` }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  switch (event.type) {
    case "payment_intent.succeeded": {
      const pi = event.data.object as Stripe.PaymentIntent;
      const { data: booking, error: fetchError } = await supabase
        .from("bookings")
        .select("id, total_amount, driver_id, host_id, status")
        .eq("stripe_payment_intent_id", pi.id)
        .single();

      if (fetchError || !booking) {
        console.error("[webhook] payment_intent.succeeded: no booking for pi", pi.id);
        break;
      }

      const expectedCents = Math.round(Number(booking.total_amount) * 100);
      const receivedCents = pi.amount_received;

      if (receivedCents === expectedCents) {
        // Sync both payment_status and booking status so app state machine stays consistent.
        await supabase.from("bookings")
          .update({ payment_status: "captured", status: "completed" })
          .eq("id", booking.id)
          // Only mark completed if the booking was still active — don't overwrite
          // already-completed or cancelled rows.
          .in("status", ["active", "approved"]);
      } else {
        await supabase.from("bookings").update({ payment_status: "review_required" }).eq("id", booking.id);
        await supabase.from("platform_events").insert({
          event_type: "payment.amount_mismatch",
          actor_role: "system",
          target_type: "booking",
          target_id: booking.id,
          amount_cents: receivedCents,
          metadata: { booking_id: booking.id, driver_id: booking.driver_id, host_id: booking.host_id, stripe_payment_intent_id: pi.id, expected_cents: expectedCents, received_cents: receivedCents },
        });
      }
      break;
    }
    case "payment_intent.payment_failed": {
      const pi = event.data.object as Stripe.PaymentIntent;
      await supabase.from("bookings")
        .update({ payment_status: "failed", status: "cancelled" })
        .eq("stripe_payment_intent_id", pi.id)
        .in("status", ["requested"]);
      break;
    }
    case "payment_intent.canceled": {
      const pi = event.data.object as Stripe.PaymentIntent;
      // Sync booking status as well so the app state machine stays consistent.
      await supabase.from("bookings")
        .update({ payment_status: "cancelled", status: "cancelled" })
        .eq("stripe_payment_intent_id", pi.id)
        .in("status", ["requested", "approved"]);
      break;
    }
    case "charge.refunded": {
      const charge = event.data.object as Stripe.Charge;
      if (charge.payment_intent) {
        await supabase.from("bookings").update({ payment_status: "refunded" }).eq("stripe_payment_intent_id", charge.payment_intent as string);
      }
      break;
    }
    default:
      break;
  }

  return new Response(JSON.stringify({ received: true }), { headers: { "Content-Type": "application/json" } });
});
