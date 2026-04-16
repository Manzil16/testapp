import Stripe from "npm:stripe@14.10.0";
import { createClient } from "npm:@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const jsonHeaders = {
  ...corsHeaders,
  "Content-Type": "application/json",
};

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), { status, headers: jsonHeaders });
}

async function getSavedCardForCustomer(
  stripe: Stripe,
  customerId: string
): Promise<{ paymentMethodId: string; card?: { brand?: string; last4?: string } } | null> {
  try {
    const customer = await stripe.customers.retrieve(customerId);
    if (!("deleted" in customer) || !customer.deleted) {
      const defaultPaymentMethod =
        typeof customer.invoice_settings?.default_payment_method === "string"
          ? customer.invoice_settings.default_payment_method
          : customer.invoice_settings?.default_payment_method?.id ?? "";

      if (defaultPaymentMethod) {
        const paymentMethod = await stripe.paymentMethods.retrieve(defaultPaymentMethod);
        return {
          paymentMethodId: paymentMethod.id,
          ...(paymentMethod.type === "card" && {
            card: {
              brand: paymentMethod.card?.brand,
              last4: paymentMethod.card?.last4,
            },
          }),
        };
      }
    }
  } catch (err) {
    console.error("[stripe-create-payment] default payment method lookup failed:", err);
  }

  const paymentMethods = await stripe.paymentMethods.list({
    customer: customerId,
    type: "card",
    limit: 1,
  });

  const primaryCard = paymentMethods.data[0];
  if (!primaryCard) {
    return null;
  }

  try {
    await stripe.customers.update(customerId, {
      invoice_settings: { default_payment_method: primaryCard.id },
    });
  } catch (err) {
    console.error("[stripe-create-payment] failed to promote default card:", err);
  }

  return {
    paymentMethodId: primaryCard.id,
    card: {
      brand: primaryCard.card?.brand,
      last4: primaryCard.card?.last4,
    },
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
  if (!stripeKey) {
    return jsonResponse({ stripeNotConfigured: true });
  }

  try {
    const { bookingId, amount, hostStripeAccountId } = await req.json();

    if (!bookingId || !amount) {
      return jsonResponse({ error: "bookingId and amount are required" }, 400);
    }

    const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" });
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Read fee config — fall back to 10% / 10% if platform_config table doesn't exist yet
    const [{ data: feeData }, { data: hostFeeData }] =
      await Promise.all([
        supabase.from("platform_config").select("value").eq("key", "platform_fee_percent").single(),
        supabase.from("platform_config").select("value").eq("key", "host_fee_percent").single(),
      ]);

    const platformFeePercent = parseFloat(feeData?.value ?? "10");
    const hostFeePercent = parseFloat(hostFeeData?.value ?? "10");

    const safePlatformFee = isNaN(platformFeePercent) ? 10 : platformFeePercent;
    const safeHostFee = isNaN(hostFeePercent) ? 10 : hostFeePercent;

    const { data: booking, error: bookingError } = await supabase
      .from("bookings")
      .select("host_id, driver_id")
      .eq("id", bookingId)
      .single();

    if (bookingError || !booking) {
      return jsonResponse({ error: "Booking not found." }, 404);
    }

    const [{ data: driverProfile, error: driverProfileError }, hostProfileResult] = await Promise.all([
      supabase
        .from("profiles")
        .select("stripe_customer_id")
        .eq("id", booking.driver_id)
        .single(),
      booking.host_id
        ? supabase
            .from("profiles")
            .select("stripe_account_id")
            .eq("id", booking.host_id)
            .single()
        : Promise.resolve({ data: null, error: null }),
    ]);

    if (driverProfileError || !driverProfile?.stripe_customer_id) {
      return jsonResponse(
        { error: "You need to add a payment method before booking this charger." },
        409
      );
    }

    const savedCard = await getSavedCardForCustomer(stripe, driverProfile.stripe_customer_id);
    if (!savedCard) {
      return jsonResponse(
        { error: "No saved card was found for your account. Please add a payment method and try again." },
        409
      );
    }

    let payoutDestination = "";

    if (hostProfileResult.error) {
      return jsonResponse({ error: "Host payout account could not be loaded." }, 409);
    }

    payoutDestination = (hostProfileResult.data?.stripe_account_id ?? "").trim();

    if (!payoutDestination) {
      payoutDestination = typeof hostStripeAccountId === "string" ? hostStripeAccountId.trim() : "";
    }

    if (!payoutDestination) {
      return jsonResponse(
        { error: "This host has not finished setting up Stripe payouts yet." },
        409
      );
    }

    let hostAccount: Stripe.Account;
    try {
      hostAccount = await stripe.accounts.retrieve(payoutDestination);
    } catch (err) {
      return jsonResponse(
        { error: err instanceof Error ? err.message : "Host payout account could not be verified." },
        409
      );
    }

    if (!(hostAccount.charges_enabled && hostAccount.payouts_enabled)) {
      return jsonResponse(
        { error: "This host's Stripe account is not ready to accept bookings yet." },
        409
      );
    }

    const intentParams: Record<string, unknown> = {
      amount,
      currency: "aud",
      capture_method: "manual",
      confirm: true,
      off_session: true,
      customer: driverProfile.stripe_customer_id,
      payment_method: savedCard.paymentMethodId,
      description: `VehicleGrid booking ${bookingId}`,
      metadata: { bookingId, platform: "vehiclegrid" },
    };

    const guestFeeAmount = Math.round(amount * (safePlatformFee / (100 + safePlatformFee)));
    const hostFeeAmount = Math.round((amount - guestFeeAmount) * (safeHostFee / 100));
    intentParams.application_fee_amount = guestFeeAmount + hostFeeAmount;
    intentParams.transfer_data = { destination: payoutDestination };

    const paymentIntent = await stripe.paymentIntents.create(
      intentParams as Parameters<typeof stripe.paymentIntents.create>[0],
      { idempotencyKey: `payment_create_${bookingId}` }
    );

    if (paymentIntent.status !== "requires_capture") {
      try {
        await stripe.paymentIntents.cancel(paymentIntent.id);
      } catch {
        // Best effort. Some statuses are not cancellable.
      }

      return jsonResponse(
        { error: `Payment authorization was not completed. Stripe returned status "${paymentIntent.status}".` },
        409
      );
    }

    const { error: updateError } = await supabase
      .from("bookings")
      .update({
        stripe_payment_intent_id: paymentIntent.id,
        payment_status: "authorized",
      })
      .eq("id", bookingId);

    if (updateError) {
      try {
        await stripe.paymentIntents.cancel(paymentIntent.id);
      } catch {
        // Best effort. Stripe will eventually expire an uncaptured hold.
      }

      return jsonResponse({ error: "Failed to record payment intent. Please try again." }, 500);
    }

    return jsonResponse({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      card: savedCard.card,
    });
  } catch (err) {
    const stripeError = err as {
      code?: string;
      type?: string;
      message?: string;
    };

    if (stripeError.code === "authentication_required") {
      return jsonResponse(
        {
          error:
            "Your saved card requires additional authentication. Please update your payment method and try again.",
        },
        409
      );
    }

    if (stripeError.type === "StripeCardError") {
      return jsonResponse(
        { error: stripeError.message ?? "Your card could not be authorized." },
        402
      );
    }

    return jsonResponse(
      { error: err instanceof Error ? err.message : "Failed to create payment intent" },
      500
    );
  }
});
