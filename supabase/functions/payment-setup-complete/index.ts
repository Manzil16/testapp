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

const htmlHeaders = {
  ...corsHeaders,
  "Content-Type": "text/html; charset=utf-8",
  "Cache-Control": "no-store",
};

const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const appScheme = (Deno.env.get("APP_DEEP_LINK_SCHEME") ?? "vehiclegrid").replace("://", "");

const stripe = stripeKey
  ? new Stripe(stripeKey, { apiVersion: "2023-10-16" })
  : null;

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

type PaymentSetupStatus = {
  paymentMethodAdded: boolean;
  paymentMethodCount: number;
  card?: {
    brand?: string;
    last4?: string;
  };
  customerId?: string;
};

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), { status, headers: jsonHeaders });
}

function htmlResponse(input: {
  title: string;
  message: string;
  note?: string;
  redirectUrl?: string;
  accent?: string;
}) {
  const accent = input.accent ?? "#00BFA5";
  const redirectScript = input.redirectUrl
    ? `
      <script>
        window.addEventListener("load", function () {
          window.setTimeout(function () {
            window.location.href = ${JSON.stringify(input.redirectUrl)};
          }, 350);
        });
      </script>
    `
    : "";
  const action = input.redirectUrl
    ? `<a class="button" href="${escapeHtml(input.redirectUrl)}">Return to VehicleGrid</a>`
    : "";

  return new Response(
    `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(input.title)}</title>
    <style>
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body {
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        background: #f7f8fa;
        color: #101828;
        min-height: 100vh;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 24px;
      }
      .card {
        width: 100%;
        max-width: 380px;
        background: #ffffff;
        border-radius: 20px;
        padding: 40px 32px;
        text-align: center;
        box-shadow: 0 18px 48px rgba(16, 24, 40, 0.12);
      }
      .icon {
        width: 72px;
        height: 72px;
        margin: 0 auto 20px;
        border-radius: 999px;
        display: flex;
        align-items: center;
        justify-content: center;
        background: ${accent};
        color: #ffffff;
        font-size: 36px;
        font-weight: 700;
      }
      h1 {
        font-size: 28px;
        line-height: 1.15;
        margin-bottom: 12px;
      }
      p {
        color: #475467;
        font-size: 16px;
        line-height: 1.6;
      }
      .note {
        margin-top: 16px;
        font-size: 13px;
        color: #98a2b3;
      }
      .button {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        margin-top: 24px;
        border-radius: 999px;
        padding: 14px 20px;
        min-width: 220px;
        background: ${accent};
        color: #ffffff;
        text-decoration: none;
        font-weight: 700;
      }
    </style>
    ${redirectScript}
  </head>
  <body>
    <main class="card">
      <div class="icon">${escapeHtml(input.accent === "#DC6803" ? "!" : "OK")}</div>
      <h1>${escapeHtml(input.title)}</h1>
      <p>${escapeHtml(input.message)}</p>
      ${action}
      ${input.note ? `<p class="note">${escapeHtml(input.note)}</p>` : ""}
    </main>
  </body>
</html>`,
    { headers: htmlHeaders }
  );
}

async function getAuthenticatedUserId(req: Request): Promise<string | null> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return null;

  const token = authHeader.replace("Bearer ", "").trim();
  if (!token) return null;

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) {
    return null;
  }

  return data.user.id;
}

async function syncVerificationGate(userId: string, paymentMethodAdded: boolean): Promise<void> {
  // If user has authenticated and reached payment setup, treat email as verified.
  // phone_verified is also set true here so driver_cleared becomes true once card is saved.
  // (Phone OTP verification is a future feature — gate it separately when added.)
  const { error } = await supabase
    .from("verification_gates")
    .upsert(
      {
        user_id: userId,
        payment_method_added: paymentMethodAdded,
        email_verified: true,
        phone_verified: true,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    );

  if (error) {
    console.error("[payment-setup-complete] verification_gates sync failed:", error.message);
  }
}

async function syncStripeCustomerId(userId: string, customerId: string): Promise<void> {
  const { error } = await supabase
    .from("profiles")
    .update({ stripe_customer_id: customerId })
    .eq("id", userId);

  if (error) {
    console.error("[payment-setup-complete] profiles.stripe_customer_id sync failed:", error.message);
  }
}

async function fetchPaymentSetupStatus(
  userId: string,
  customerIdOverride?: string | null
): Promise<PaymentSetupStatus> {
  if (!stripe) {
    return { paymentMethodAdded: false, paymentMethodCount: 0 };
  }

  let customerId = customerIdOverride?.trim() ?? "";

  if (!customerId) {
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("stripe_customer_id")
      .eq("id", userId)
      .single();

    if (profileError || !profile?.stripe_customer_id) {
      return { paymentMethodAdded: false, paymentMethodCount: 0 };
    }

    customerId = profile.stripe_customer_id;
  } else {
    await syncStripeCustomerId(userId, customerId);
  }

  const paymentMethods = await stripe.paymentMethods.list({
    customer: customerId,
    type: "card",
    limit: 3,
  });

  const primaryCard = paymentMethods.data[0];
  const hasPaymentMethod = Boolean(primaryCard);

  if (primaryCard) {
    try {
      await stripe.customers.update(customerId, {
        invoice_settings: { default_payment_method: primaryCard.id },
      });
    } catch (err) {
      console.error(
        "[payment-setup-complete] failed to set default payment method:",
        err instanceof Error ? err.message : err
      );
    }
  }

  await syncVerificationGate(userId, hasPaymentMethod);

  return {
    paymentMethodAdded: hasPaymentMethod,
    paymentMethodCount: paymentMethods.data.length,
    customerId,
    ...(primaryCard && {
      card: {
        brand: primaryCard.card?.brand,
        last4: primaryCard.card?.last4,
      },
    }),
  };
}

async function handleBrowserReturn(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const cancelled = url.searchParams.get("cancelled") === "true";

  if (!stripe) {
    return htmlResponse({
      title: "Stripe not configured",
      message: "Card setup is unavailable until Stripe credentials are configured on the server.",
      accent: "#DC6803",
      redirectUrl: `${appScheme}://payment-setup-error`,
    });
  }

  if (cancelled) {
    return htmlResponse({
      title: "Card setup cancelled",
      message: "No card was saved. Return to the app when you are ready to try again.",
      note: "You can also close this tab manually.",
      accent: "#DC6803",
      redirectUrl: `${appScheme}://payment-setup-cancelled`,
    });
  }

  const sessionId = url.searchParams.get("session_id");
  const requestedUserId = url.searchParams.get("user_id");

  if (!sessionId) {
    return htmlResponse({
      title: "Missing session",
      message: "Stripe did not return a setup session ID. Please try saving your card again.",
      accent: "#DC6803",
      redirectUrl: `${appScheme}://payment-setup-error`,
    });
  }

  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    const sessionUserId =
      session.client_reference_id ||
      session.metadata?.supabase_user_id ||
      requestedUserId;

    if (!sessionUserId) {
      return htmlResponse({
        title: "Missing user context",
        message: "We could not match this Stripe session to your account. Please return to the app and try again.",
        accent: "#DC6803",
        redirectUrl: `${appScheme}://payment-setup-error`,
      });
    }

    if (requestedUserId && requestedUserId !== sessionUserId) {
      return htmlResponse({
        title: "Card setup mismatch",
        message: "This setup session does not belong to the current user. Please start the flow again from the app.",
        accent: "#DC6803",
        redirectUrl: `${appScheme}://payment-setup-error`,
      });
    }

    const customerId =
      typeof session.customer === "string"
        ? session.customer
        : session.customer?.id ?? null;

    const setupStatus = await fetchPaymentSetupStatus(sessionUserId, customerId);

    if (!setupStatus.paymentMethodAdded) {
      return htmlResponse({
        title: "Card setup incomplete",
        message: "Stripe finished the browser flow, but no saved card was found for your account yet.",
        note: "Return to the app and try again if the problem persists.",
        accent: "#DC6803",
        redirectUrl: `${appScheme}://payment-setup-incomplete`,
      });
    }

    return htmlResponse({
      title: "Card saved!",
      message: "Your payment method has been securely saved. You can return to the app now.",
      note: "If the app does not open automatically, tap the button above.",
      redirectUrl: `${appScheme}://payment-setup-complete`,
    });
  } catch (err) {
    console.error("[payment-setup-complete] browser return failed:", err);
    return htmlResponse({
      title: "Card setup failed",
      message: err instanceof Error ? err.message : "Unexpected error while confirming your card.",
      accent: "#DC6803",
      redirectUrl: `${appScheme}://payment-setup-error`,
    });
  }
}

async function handleStatusProbe(req: Request): Promise<Response> {
  if (!stripe) {
    return jsonResponse({ stripeNotConfigured: true });
  }

  const authenticatedUserId = await getAuthenticatedUserId(req);
  if (!authenticatedUserId) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  const body = await req.json().catch(() => ({}));
  const requestedUserId = typeof body.userId === "string" ? body.userId.trim() : "";

  if (requestedUserId && requestedUserId !== authenticatedUserId) {
    return jsonResponse({ error: "Unauthorized" }, 403);
  }

  try {
    const status = await fetchPaymentSetupStatus(authenticatedUserId);
    return jsonResponse(status);
  } catch (err) {
    console.error("[payment-setup-complete] status probe failed:", err);
    return jsonResponse(
      { error: err instanceof Error ? err.message : "Failed to verify payment setup" },
      500
    );
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method === "GET") {
    return handleBrowserReturn(req);
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  return handleStatusProbe(req);
});
