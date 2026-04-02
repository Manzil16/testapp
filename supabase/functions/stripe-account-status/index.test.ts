/**
 * Tests for stripe-account-status
 *
 * Logic under test:
 *  1. OPTIONS                                → 200 "ok"
 *  2. Missing hostUserId                     → 400
 *  3. Profile has no stripe_account_id       → { isOnboarded: false, accountId: null, dashboardUrl: null }
 *  4. Account fully onboarded                → { isOnboarded: true, accountId, dashboardUrl }
 *  5. Account charges_enabled but NOT payouts_enabled → { isOnboarded: false, no dashboardUrl }
 *  6. Account payouts_enabled but NOT charges_enabled → { isOnboarded: false, no dashboardUrl }
 *  7. Stripe accounts.retrieve throws        → 500
 */

import { assertEquals } from "https://deno.land/std@0.177.0/testing/asserts.ts";
import { CORS_HEADERS, postJson, parseJson } from "../_test_utils/mod.ts";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type StripeAccount = {
  id: string;
  charges_enabled: boolean;
  payouts_enabled: boolean;
};

type FakeStripe = {
  accounts: {
    retrieve: (id: string) => Promise<StripeAccount>;
    createLoginLink: (id: string) => Promise<{ url: string }>;
  };
};

type SupabaseConfig = {
  stripeAccountId?: string | null;
};

// ---------------------------------------------------------------------------
// Supabase mock factory
// ---------------------------------------------------------------------------

function makeSupabase(cfg: SupabaseConfig = {}) {
  return {
    from: (table: string) => {
      if (table === "profiles") {
        return {
          select: (_cols?: string) => ({
            eq: (_col: string, _val: unknown) => ({
              single: () =>
                Promise.resolve({
                  data: cfg.stripeAccountId !== undefined
                    ? { stripe_account_id: cfg.stripeAccountId }
                    : null,
                  error: null,
                }),
            }),
          }),
        };
      }
      return {};
    },
  };
}

// ---------------------------------------------------------------------------
// Handler factory (mirrors stripe-account-status/index.ts)
// ---------------------------------------------------------------------------

function makeHandler(stripe: FakeStripe, supabase: ReturnType<typeof makeSupabase>) {
  return async (req: Request): Promise<Response> => {
    if (req.method === "OPTIONS") {
      return new Response("ok", { headers: CORS_HEADERS });
    }
    try {
      const { hostUserId } = await req.json();

      if (!hostUserId) {
        return new Response(JSON.stringify({ error: "hostUserId is required" }), {
          status: 400,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        });
      }

      const { data: profile } = await (supabase as any)
        .from("profiles")
        .select("stripe_account_id")
        .eq("id", hostUserId)
        .single();

      const accountId: string | null = profile?.stripe_account_id ?? null;

      if (!accountId) {
        return new Response(
          JSON.stringify({ isOnboarded: false, accountId: null, dashboardUrl: null }),
          { headers: { ...CORS_HEADERS, "Content-Type": "application/json" } },
        );
      }

      const account = await stripe.accounts.retrieve(accountId);
      const isOnboarded = account.charges_enabled && account.payouts_enabled;

      let dashboardUrl: string | null = null;
      if (isOnboarded) {
        const loginLink = await stripe.accounts.createLoginLink(accountId);
        dashboardUrl = loginLink.url;
      }

      return new Response(
        JSON.stringify({ isOnboarded, accountId, dashboardUrl }),
        { headers: { ...CORS_HEADERS, "Content-Type": "application/json" } },
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to check Stripe status";
      return new Response(JSON.stringify({ error: msg }), {
        status: 500,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeStripe(account?: Partial<StripeAccount>): FakeStripe {
  const merged: StripeAccount = {
    id: "acct_default",
    charges_enabled: true,
    payouts_enabled: true,
    ...account,
  };
  return {
    accounts: {
      retrieve: (_id) => Promise.resolve(merged),
      createLoginLink: (id) =>
        Promise.resolve({ url: `https://connect.stripe.com/express/login/${id}` }),
    },
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

Deno.test("OPTIONS returns 200 ok", async () => {
  const res = await makeHandler(makeStripe(), makeSupabase())(
    new Request("http://localhost", { method: "OPTIONS" }),
  );
  assertEquals(res.status, 200);
  assertEquals(await res.text(), "ok");
});

Deno.test("missing hostUserId returns 400", async () => {
  const { status, body } = await parseJson(
    await makeHandler(makeStripe(), makeSupabase())(
      postJson("http://localhost", {}),
    ),
  );
  assertEquals(status, 400);
  assertEquals(body.error, "hostUserId is required");
});

Deno.test("profile has no stripe_account_id — returns isOnboarded: false", async () => {
  const { status, body } = await parseJson(
    await makeHandler(makeStripe(), makeSupabase({ stripeAccountId: null }))(
      postJson("http://localhost", { hostUserId: "host-no-stripe" }),
    ),
  );
  assertEquals(status, 200);
  assertEquals(body.isOnboarded, false);
  assertEquals(body.accountId, null);
  assertEquals(body.dashboardUrl, null);
});

Deno.test("fully onboarded host — isOnboarded: true, dashboardUrl returned", async () => {
  const stripe = makeStripe({ id: "acct_full", charges_enabled: true, payouts_enabled: true });

  const { status, body } = await parseJson(
    await makeHandler(stripe, makeSupabase({ stripeAccountId: "acct_full" }))(
      postJson("http://localhost", { hostUserId: "host-onboarded" }),
    ),
  );

  assertEquals(status, 200);
  assertEquals(body.isOnboarded, true);
  assertEquals(body.accountId, "acct_full");
  assertEquals(typeof body.dashboardUrl, "string");
  assertEquals((body.dashboardUrl as string).includes("acct_full"), true);
});

Deno.test("charges_enabled but payouts_enabled=false — isOnboarded: false, no dashboardUrl", async () => {
  const stripe = makeStripe({ charges_enabled: true, payouts_enabled: false });

  const { body } = await parseJson(
    await makeHandler(stripe, makeSupabase({ stripeAccountId: "acct_partial_1" }))(
      postJson("http://localhost", { hostUserId: "host-partial-1" }),
    ),
  );

  assertEquals(body.isOnboarded, false);
  assertEquals(body.dashboardUrl, null);
});

Deno.test("payouts_enabled but charges_enabled=false — isOnboarded: false, no dashboardUrl", async () => {
  const stripe = makeStripe({ charges_enabled: false, payouts_enabled: true });

  const { body } = await parseJson(
    await makeHandler(stripe, makeSupabase({ stripeAccountId: "acct_partial_2" }))(
      postJson("http://localhost", { hostUserId: "host-partial-2" }),
    ),
  );

  assertEquals(body.isOnboarded, false);
  assertEquals(body.dashboardUrl, null);
});

Deno.test("createLoginLink NOT called when account is not fully onboarded", async () => {
  let loginLinkCalled = false;
  const stripe: FakeStripe = {
    accounts: {
      retrieve: (_id) =>
        Promise.resolve({ id: "acct_partial", charges_enabled: false, payouts_enabled: true }),
      createLoginLink: (_id) => {
        loginLinkCalled = true;
        return Promise.resolve({ url: "should-not-be-called" });
      },
    },
  };

  await makeHandler(stripe, makeSupabase({ stripeAccountId: "acct_partial" }))(
    postJson("http://localhost", { hostUserId: "host-partial" }),
  );

  assertEquals(loginLinkCalled, false);
});

Deno.test("Stripe accounts.retrieve error returns 500", async () => {
  const stripe: FakeStripe = {
    accounts: {
      retrieve: () => Promise.reject(new Error("Stripe account not found")),
      createLoginLink: (_id) => Promise.resolve({ url: "" }),
    },
  };

  const { status, body } = await parseJson(
    await makeHandler(stripe, makeSupabase({ stripeAccountId: "acct_missing" }))(
      postJson("http://localhost", { hostUserId: "host-stripe-err" }),
    ),
  );
  assertEquals(status, 500);
  assertEquals(body.error, "Stripe account not found");
});

Deno.test("accountId in response matches the ID stored in profile", async () => {
  const { body } = await parseJson(
    await makeHandler(
      makeStripe({ id: "acct_id_check" }),
      makeSupabase({ stripeAccountId: "acct_id_check" }),
    )(postJson("http://localhost", { hostUserId: "host-id-check" })),
  );

  assertEquals(body.accountId, "acct_id_check");
});
