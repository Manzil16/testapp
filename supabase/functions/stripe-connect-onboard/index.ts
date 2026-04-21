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

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("stripe_account_id, email, display_name")
      .eq("id", hostUserId)
      .single();

    if (profileError || !profile) {
      return jsonResponse(
        { error: `Host profile not found. Please sign out, sign back in, and try again.` },
        404
      );
    }

    let accountId = profile.stripe_account_id?.trim() ?? "";

    // Verify an existing Stripe account still exists. Only wipe on explicit
    // "No such account" responses — transient errors (rate limits, network
    // blips) previously triggered duplicate account creation and 500s on the
    // refresh_url path.
    if (accountId) {
      try {
        await stripe.accounts.retrieve(accountId);
      } catch (err) {
        const stripeErr = err as { code?: string; type?: string; statusCode?: number };
        const isMissing =
          stripeErr.code === "resource_missing" ||
          stripeErr.code === "account_invalid" ||
          stripeErr.statusCode === 404;
        if (isMissing) {
          accountId = "";
        } else {
          throw err;
        }
      }
    }

    if (!accountId) {
      const account = await stripe.accounts.create({
        type: "express",
        country: "AU",
        email: profile.email ?? undefined,
        business_profile: {
          name: profile.display_name || undefined,
          product_description: "EV charging station host on VehicleGrid",
        },
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
      });
      accountId = account.id;

      const { error: updateError } = await supabase
        .from("profiles")
        .update({ stripe_account_id: accountId })
        .eq("id", hostUserId);

      if (updateError) {
        return jsonResponse(
          { error: `Failed to save Stripe account: ${updateError.message}` },
          500
        );
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
    const stripeErr = err as { type?: string; code?: string; message?: string; raw?: { message?: string } };
    const detail =
      stripeErr.raw?.message ||
      stripeErr.message ||
      (err instanceof Error ? err.message : "Failed to create Stripe account");
    const prefix = stripeErr.type ? `[${stripeErr.type}${stripeErr.code ? `:${stripeErr.code}` : ""}] ` : "";

    // On the GET ?refresh=true path, a 500 leaves the user stranded on a Stripe
    // redirect. Fall back to redirecting them to the account-status page so the
    // app can show a meaningful state instead of a browser error.
    if (req.method === "GET" && new URL(req.url).searchParams.get("refresh") === "true") {
      const hostUserId = new URL(req.url).searchParams.get("hostUserId") ?? "";
      const fallback = buildFunctionUrl("stripe-account-status", { hostUserId });
      console.error("[stripe-connect-onboard] refresh failed:", `${prefix}${detail}`);
      return Response.redirect(fallback, 303);
    }

    return jsonResponse({ error: `${prefix}${detail}` }, 500);
  }
});
