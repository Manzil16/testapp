// Supabase Edge Function: Check Stripe Account Status
// Returns onboarding status and dashboard URL for a host's Stripe account.

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

  try {
    const { hostUserId } = await req.json();

    if (!hostUserId) {
      return new Response(
        JSON.stringify({ error: "hostUserId is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { data: profile } = await supabase
      .from("profiles")
      .select("stripe_account_id")
      .eq("id", hostUserId)
      .single();

    const accountId = profile?.stripe_account_id;

    if (!accountId) {
      return new Response(
        JSON.stringify({
          isOnboarded: false,
          accountId: null,
          dashboardUrl: null,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check account details
    const account = await stripe.accounts.retrieve(accountId);
    const isOnboarded =
      account.charges_enabled && account.payouts_enabled;

    // Generate dashboard login link if onboarded
    let dashboardUrl: string | null = null;
    if (isOnboarded) {
      const loginLink = await stripe.accounts.createLoginLink(accountId);
      dashboardUrl = loginLink.url;
    }

    return new Response(
      JSON.stringify({
        isOnboarded,
        accountId,
        dashboardUrl,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message || "Failed to check Stripe status" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
