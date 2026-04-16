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

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), { status, headers: jsonHeaders });
}

function buildFunctionUrl(path: string, params: Record<string, string>): string {
  const url = new URL(`${supabaseUrl}/functions/v1/${path}`);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return url.toString();
}

async function resolveHostUserId(req: Request): Promise<string | null> {
  if (req.method === "GET") {
    const url = new URL(req.url);
    return url.searchParams.get("hostUserId");
  }

  const body = await req.json().catch(() => ({}));
  return typeof body.hostUserId === "string" ? body.hostUserId : null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
  if (!stripeKey) {
    return jsonResponse({ stripeNotConfigured: true });
  }

  try {
    const hostUserId = await resolveHostUserId(req);

    if (!hostUserId) {
      return jsonResponse({ error: "hostUserId is required" }, 400);
    }

    const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" });
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    const { data: profile } = await supabase
      .from("profiles")
      .select("stripe_account_id, email, display_name")
      .eq("id", hostUserId)
      .single();

    let accountId = profile?.stripe_account_id?.trim() ?? "";

    if (!accountId) {
      const account = await stripe.accounts.create({
        type: "express",
        country: "AU",
        email: profile?.email ?? undefined,
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

      if (profile) {
        const { error: updateError } = await supabase
          .from("profiles")
          .update({ stripe_account_id: accountId })
          .eq("id", hostUserId);

        if (updateError) {
          return jsonResponse({ error: updateError.message }, 500);
        }
      }
    }

    const refreshUrl = buildFunctionUrl("stripe-connect-onboard", {
      refresh: "true",
      hostUserId,
    });
    const returnUrl = buildFunctionUrl("stripe-account-status", {
      hostUserId,
    });

    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: refreshUrl,
      return_url: returnUrl,
      type: "account_onboarding",
    });

    if (req.method === "GET" && new URL(req.url).searchParams.get("refresh") === "true") {
      return Response.redirect(accountLink.url, 303);
    }

    return jsonResponse({ accountId, onboardingUrl: accountLink.url });
  } catch (err) {
    return jsonResponse(
      { error: err instanceof Error ? err.message : "Failed to create Stripe account" },
      500
    );
  }
});
