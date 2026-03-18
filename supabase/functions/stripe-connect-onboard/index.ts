// Supabase Edge Function: Stripe Connect Onboarding
// Creates a Stripe Connect Express account for a host and returns an onboarding link.

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
    const { hostUserId } = await req.json();

    if (!hostUserId) {
      return new Response(JSON.stringify({ error: "hostUserId is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Check if host already has a Stripe account
    const { data: profile } = await supabase
      .from("profiles")
      .select("stripe_account_id, email, display_name")
      .eq("id", hostUserId)
      .single();

    let accountId = profile?.stripe_account_id;

    if (!accountId) {
      // Create new Stripe Connect Express account
      const account = await stripe.accounts.create({
        type: "express",
        country: "AU",
        email: profile?.email,
        business_profile: {
          name: profile?.display_name || undefined,
          product_description: "EV charging station host on VehicleGrid",
        },
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
      });

      accountId = account.id;

      // Store the Stripe account ID on the profile
      await supabase
        .from("profiles")
        .update({ stripe_account_id: accountId })
        .eq("id", hostUserId);
    }

    // Create an account link for onboarding
    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${supabaseUrl}/functions/v1/stripe-connect-onboard?refresh=true`,
      return_url: `${supabaseUrl}/functions/v1/stripe-account-status?hostUserId=${hostUserId}`,
      type: "account_onboarding",
    });

    return new Response(
      JSON.stringify({
        accountId,
        onboardingUrl: accountLink.url,
      }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message || "Failed to create Stripe account" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
