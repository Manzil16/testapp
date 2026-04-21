import Stripe from "npm:stripe@14.10.0";
import { createClient } from "npm:@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const FREE_CANCELLATION_HOURS = 2;

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
    const { bookingId } = await req.json();

    if (!bookingId) {
      return new Response(
        JSON.stringify({ error: "bookingId is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

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
      await supabase
        .from("bookings")
        .update({ status: "cancelled", cancelled_at: new Date().toISOString() })
        .eq("id", bookingId);
      return new Response(
        JSON.stringify({ refunded: false, reason: "No payment to refund" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" });

    // Retrieve the PaymentIntent to check its current status.
    // PaymentIntents created with capture_method: 'manual' sit in 'requires_capture'
    // until explicitly captured. Stripe does NOT allow refunds on uncaptured intents —
    // they must be cancelled instead. Only call refunds.create if already 'succeeded'.
    const pi = await stripe.paymentIntents.retrieve(booking.stripe_payment_intent_id);

    const startTime = new Date(booking.start_time);
    const hoursUntilStart = (startTime.getTime() - Date.now()) / (1000 * 60 * 60);
    const isFullRefund = hoursUntilStart >= FREE_CANCELLATION_HOURS;

    let newPaymentStatus: string;

    if (pi.status === "requires_capture") {
      // Hold not yet captured — cancel the intent to release the hold entirely.
      // Cancellation always releases 100% regardless of timing, which is correct
      // since the driver is cancelling before the session started.
      await stripe.paymentIntents.cancel(booking.stripe_payment_intent_id, {
        cancellation_reason: "requested_by_customer",
      });
      newPaymentStatus = "cancelled";
    } else if (pi.status === "succeeded") {
      // Payment was already captured (e.g. partial capture after session) —
      // issue a Stripe refund for the appropriate amount.
      const capturedAmount = booking.actual_amount ?? booking.total_amount;
      const refundAmount = isFullRefund
        ? Math.round(capturedAmount * 100)
        : Math.round(capturedAmount * 100 * 0.5);
      await stripe.refunds.create(
        { payment_intent: booking.stripe_payment_intent_id, amount: refundAmount },
        { idempotencyKey: `refund_${bookingId}` }
      );
      newPaymentStatus = "refunded";
    } else {
      // Already cancelled or in an unactionable state — just mark the booking.
      newPaymentStatus = "cancelled";
    }

    await supabase
      .from("bookings")
      .update({ status: "cancelled", payment_status: newPaymentStatus, cancelled_at: new Date().toISOString() })
      .eq("id", bookingId);

    return new Response(
      JSON.stringify({ refunded: newPaymentStatus === "refunded", fullRefund: isFullRefund, paymentStatus: newPaymentStatus }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Failed to process refund" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
