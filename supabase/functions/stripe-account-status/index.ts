import Stripe from "npm:stripe@14.10.0";
import { createClient } from "npm:@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
  if (!stripeKey) {
    return new Response(
      JSON.stringify({ connected: false, stripeNotConfigured: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    let hostUserId: string | null = null;
    const url = new URL(req.url);

    if (req.method === "GET") {
      hostUserId = url.searchParams.get("hostUserId");
    } else {
      const body = await req.json().catch(() => ({}));
      hostUserId = body.hostUserId ?? null;
    }

    if (!hostUserId) {
      return new Response(
        JSON.stringify({ error: "hostUserId is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" });
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const syncVerificationGate = async (stripeOnboarded: boolean) => {
      const { error: gateError } = await supabase
        .from("verification_gates")
        .upsert(
          {
            user_id: hostUserId,
            stripe_onboarded: stripeOnboarded,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id" }
        );

      if (gateError) {
        throw new Error(gateError.message);
      }
    };

    const { data: profile } = await supabase
      .from("profiles")
      .select("stripe_account_id")
      .eq("id", hostUserId)
      .single();

    const accountId = profile?.stripe_account_id;

    if (!accountId) {
      await syncVerificationGate(false);
      if (req.method === "GET") return Response.redirect("vehiclegrid://stripe-error?reason=no_account");
      return new Response(
        JSON.stringify({ connected: false, chargesEnabled: false, payoutsEnabled: false, accountId: null, dashboardUrl: null }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const account = await stripe.accounts.retrieve(accountId);
    const chargesEnabled = account.charges_enabled ?? false;
    const payoutsEnabled = account.payouts_enabled ?? false;
    const connected = chargesEnabled && payoutsEnabled;

    await syncVerificationGate(connected);

    if (connected) {
      const { error: eventError } = await supabase.from("platform_events").insert({
        event_type: "stripe_onboarding_completed",
        actor_user_id: hostUserId,
        actor_role: "host",
        target_type: "user",
        target_id: hostUserId,
        metadata: { stripe_account_id: accountId, charges_enabled: chargesEnabled, payouts_enabled: payoutsEnabled },
      });

      if (eventError) {
        console.error("[stripe-account-status] platform_events insert failed:", eventError.message);
      }
    }

    if (req.method === "GET") {
      return Response.redirect(connected ? "vehiclegrid://stripe-success" : "vehiclegrid://stripe-error?reason=onboarding_incomplete");
    }

    let dashboardUrl: string | null = null;
    if (connected) {
      try {
        const loginLink = await stripe.accounts.createLoginLink(accountId);
        dashboardUrl = loginLink.url;
      } catch { /* best-effort */ }
    }

    return new Response(
      JSON.stringify({ connected, chargesEnabled, payoutsEnabled, accountId, dashboardUrl }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    if (req.method === "GET") {
      return Response.redirect(`vehiclegrid://stripe-error?reason=${encodeURIComponent(err instanceof Error ? err.message : "error")}`);
    }
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Failed to check Stripe status" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
