/**
 * Tests for stripe-connect-onboard
 *
 * Logic under test:
 *  1. OPTIONS                              → 200 "ok"
 *  2. Missing hostUserId                   → 400
 *  3. New host (no stripe_account_id)      → create Stripe account + store ID + return onboarding URL
 *  4. Existing host (has stripe_account_id) → skip account creation, create fresh link
 *  5. Profile not found in DB              → still creates Stripe account (email: undefined)
 *  6. Stripe account creation throws       → 500
 */

import { assertEquals } from "https://deno.land/std@0.177.0/testing/asserts.ts";
import { CORS_HEADERS, postJson, parseJson } from "../_test_utils/mod.ts";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ProfileRow = {
  stripe_account_id: string | null;
  email: string;
  display_name: string;
} | null;

type FakeStripe = {
  accounts: {
    create: (params: unknown) => Promise<{ id: string }>;
  };
  accountLinks: {
    create: (params: unknown) => Promise<{ url: string }>;
  };
};

type SupabaseConfig = {
  profile?: ProfileRow;
  storedAccountId?: string[];  // collects update calls for verification
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
                  data: cfg.profile !== undefined ? cfg.profile : null,
                  error: cfg.profile === null ? { message: "Not found" } : null,
                }),
            }),
          }),
          update: (data: unknown) => ({
            eq: (_col: string, _val: unknown) => {
              if (cfg.storedAccountId) {
                cfg.storedAccountId.push((data as any).stripe_account_id);
              }
              return Promise.resolve({ data: null, error: null });
            },
          }),
        };
      }
      return {};
    },
  };
}

// ---------------------------------------------------------------------------
// Handler factory (mirrors stripe-connect-onboard/index.ts)
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
        .select("stripe_account_id, email, display_name")
        .eq("id", hostUserId)
        .single();

      let accountId: string | null = profile?.stripe_account_id ?? null;

      if (!accountId) {
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

        await (supabase as any)
          .from("profiles")
          .update({ stripe_account_id: accountId })
          .eq("id", hostUserId);
      }

      const accountLink = await stripe.accountLinks.create({
        account: accountId,
        refresh_url: "http://supabase.test/functions/v1/stripe-connect-onboard?refresh=true",
        return_url: `http://supabase.test/functions/v1/stripe-account-status?hostUserId=${hostUserId}`,
        type: "account_onboarding",
      });

      return new Response(
        JSON.stringify({ accountId, onboardingUrl: accountLink.url }),
        { headers: { ...CORS_HEADERS, "Content-Type": "application/json" } },
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to create Stripe account";
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

function defaultStripe(accountId = "acct_new_001"): FakeStripe {
  return {
    accounts: {
      create: (_params) => Promise.resolve({ id: accountId }),
    },
    accountLinks: {
      create: (_params) => Promise.resolve({ url: `https://connect.stripe.com/setup/${accountId}` }),
    },
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

Deno.test("OPTIONS returns 200 ok", async () => {
  const res = await makeHandler(defaultStripe(), makeSupabase())(
    new Request("http://localhost", { method: "OPTIONS" }),
  );
  assertEquals(res.status, 200);
  assertEquals(await res.text(), "ok");
});

Deno.test("missing hostUserId returns 400", async () => {
  const { status, body } = await parseJson(
    await makeHandler(defaultStripe(), makeSupabase())(
      postJson("http://localhost", {}),
    ),
  );
  assertEquals(status, 400);
  assertEquals(body.error, "hostUserId is required");
});

Deno.test("new host — Stripe account created, ID stored in profile, onboarding URL returned", async () => {
  const createCalls: unknown[] = [];
  const storedAccountId: string[] = [];

  const stripe: FakeStripe = {
    accounts: {
      create: (params) => {
        createCalls.push(params);
        return Promise.resolve({ id: "acct_brand_new" });
      },
    },
    accountLinks: {
      create: (_p) => Promise.resolve({ url: "https://connect.stripe.com/setup/acct_brand_new" }),
    },
  };

  const profile: ProfileRow = {
    stripe_account_id: null,
    email: "host@example.com",
    display_name: "Test Host",
  };

  const { status, body } = await parseJson(
    await makeHandler(stripe, makeSupabase({ profile, storedAccountId }))(
      postJson("http://localhost", { hostUserId: "host-uuid-new" }),
    ),
  );

  assertEquals(status, 200);
  assertEquals(body.accountId, "acct_brand_new");
  assertEquals((body.onboardingUrl as string).includes("acct_brand_new"), true);

  // account.create was called once
  assertEquals(createCalls.length, 1);
  // stripe_account_id was written back to profiles
  assertEquals(storedAccountId[0], "acct_brand_new");
});

Deno.test("new host — account.create called with correct email and country", async () => {
  let capturedParams: unknown;
  const stripe: FakeStripe = {
    accounts: {
      create: (params) => {
        capturedParams = params;
        return Promise.resolve({ id: "acct_check_params" });
      },
    },
    accountLinks: {
      create: (_p) => Promise.resolve({ url: "https://connect.stripe.com/x" }),
    },
  };

  const profile: ProfileRow = {
    stripe_account_id: null,
    email: "evan@ev.io",
    display_name: "Evan",
  };

  await makeHandler(stripe, makeSupabase({ profile }))(
    postJson("http://localhost", { hostUserId: "host-check" }),
  );

  assertEquals((capturedParams as any).country, "AU");
  assertEquals((capturedParams as any).email, "evan@ev.io");
  assertEquals((capturedParams as any).type, "express");
});

Deno.test("existing host — account.create NOT called, existing ID reused in link", async () => {
  const createCalls: string[] = [];
  const stripe: FakeStripe = {
    accounts: {
      create: (_p) => {
        createCalls.push("called");
        return Promise.resolve({ id: "acct_should_not_appear" });
      },
    },
    accountLinks: {
      create: (params) =>
        Promise.resolve({ url: `https://connect.stripe.com/setup/${(params as any).account}` }),
    },
  };

  const profile: ProfileRow = {
    stripe_account_id: "acct_existing_999",
    email: "existing@host.com",
    display_name: "Existing",
  };

  const { status, body } = await parseJson(
    await makeHandler(stripe, makeSupabase({ profile }))(
      postJson("http://localhost", { hostUserId: "host-existing" }),
    ),
  );

  assertEquals(status, 200);
  assertEquals(body.accountId, "acct_existing_999");
  assertEquals((body.onboardingUrl as string).includes("acct_existing_999"), true);
  assertEquals(createCalls.length, 0, "accounts.create should NOT be called for existing host");
});

Deno.test("profile not found — account created without email (undefined)", async () => {
  let capturedEmail: unknown = "NOT_CHECKED";
  const stripe: FakeStripe = {
    accounts: {
      create: (params) => {
        capturedEmail = (params as any).email;
        return Promise.resolve({ id: "acct_no_profile" });
      },
    },
    accountLinks: {
      create: (_p) => Promise.resolve({ url: "https://connect.stripe.com/x" }),
    },
  };

  const { status } = await parseJson(
    await makeHandler(stripe, makeSupabase({ profile: null }))(
      postJson("http://localhost", { hostUserId: "host-no-profile" }),
    ),
  );

  assertEquals(status, 200);
  // email should be undefined (profile is null, profile?.email = undefined)
  assertEquals(capturedEmail, undefined);
});

Deno.test("Stripe account creation error returns 500", async () => {
  const stripe: FakeStripe = {
    accounts: {
      create: () => Promise.reject(new Error("Stripe account limit reached")),
    },
    accountLinks: {
      create: (_p) => Promise.resolve({ url: "" }),
    },
  };

  const profile: ProfileRow = { stripe_account_id: null, email: "e@e.com", display_name: "E" };

  const { status, body } = await parseJson(
    await makeHandler(stripe, makeSupabase({ profile }))(
      postJson("http://localhost", { hostUserId: "host-stripe-fail" }),
    ),
  );
  assertEquals(status, 500);
  assertEquals(body.error, "Stripe account limit reached");
});
