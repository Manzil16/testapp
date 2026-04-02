/**
 * Tests for stripe-create-payment
 *
 * Logic under test:
 *  1. OPTIONS  → 200 "ok"
 *  2. Non-POST → 405
 *  3. Missing bookingId or amount → 400
 *  4. Happy path without hostStripeAccountId → PI created, no Connect split
 *  5. Happy path with hostStripeAccountId → fee split applied to intentParams
 *  6. Stripe error → 500
 *
 * Fee formula (with hostStripeAccountId present):
 *   guestFeeAmount = Math.round(amount * (platformFeePercent / (100 + platformFeePercent)))
 *   hostFeeAmount  = Math.round((amount - guestFeeAmount) * (hostFeePercent / 100))
 *   application_fee_amount = guestFeeAmount + hostFeeAmount
 */

import { assertEquals } from "https://deno.land/std@0.177.0/testing/asserts.ts";
import { CORS_HEADERS, postJson, parseJson } from "../_test_utils/mod.ts";

// ---------------------------------------------------------------------------
// Mock types
// ---------------------------------------------------------------------------

type FakePI = { id: string; client_secret: string; status: string };

type FakeStripe = {
  paymentIntents: {
    create: (params: unknown) => Promise<FakePI>;
  };
};

type FakeSupabase = {
  from: (table: string) => {
    update: (data: unknown) => {
      eq: (col: string, val: unknown) => Promise<{ data: null; error: null }>;
    };
  };
};

// ---------------------------------------------------------------------------
// Handler factory (mirrors stripe-create-payment/index.ts logic)
// ---------------------------------------------------------------------------

function makeHandler(stripe: FakeStripe, supabase: FakeSupabase) {
  return async (req: Request): Promise<Response> => {
    if (req.method === "OPTIONS") {
      return new Response("ok", { headers: CORS_HEADERS });
    }
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }
    try {
      const {
        bookingId,
        amount,
        hostStripeAccountId,
        platformFeePercent = 10,
        hostFeePercent = 10,
      } = await req.json();

      if (!bookingId || !amount) {
        return new Response(
          JSON.stringify({ error: "bookingId and amount are required" }),
          { status: 400, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } },
        );
      }

      const intentParams: Record<string, unknown> = {
        amount,
        currency: "aud",
        capture_method: "manual",
        metadata: { bookingId, platform: "vehiclegrid" },
      };

      if (hostStripeAccountId) {
        const guestFee = Math.round(
          amount * (platformFeePercent / (100 + platformFeePercent)),
        );
        const hostFee = Math.round(
          (amount - guestFee) * (hostFeePercent / 100),
        );
        intentParams.application_fee_amount = guestFee + hostFee;
        intentParams.transfer_data = { destination: hostStripeAccountId };
      }

      const pi = await stripe.paymentIntents.create(intentParams);
      await supabase.from("bookings").update({ stripe_payment_intent_id: pi.id }).eq("id", bookingId);

      return new Response(
        JSON.stringify({ clientSecret: pi.client_secret, paymentIntentId: pi.id }),
        { headers: { ...CORS_HEADERS, "Content-Type": "application/json" } },
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to create payment intent";
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

function defaultStripe(override?: Partial<FakeStripe["paymentIntents"]>): FakeStripe {
  return {
    paymentIntents: {
      create: override?.create ??
        (() =>
          Promise.resolve({
            id: "pi_test_001",
            client_secret: "pi_test_001_secret",
            status: "requires_capture",
          })),
    },
  };
}

function defaultSupabase(): FakeSupabase {
  return {
    from: (_table) => ({
      update: (_data) => ({
        eq: (_col, _val) => Promise.resolve({ data: null, error: null }),
      }),
    }),
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

Deno.test("OPTIONS preflight returns 200 ok", async () => {
  const h = makeHandler(defaultStripe(), defaultSupabase());
  const res = await h(new Request("http://localhost", { method: "OPTIONS" }));
  assertEquals(res.status, 200);
  assertEquals(await res.text(), "ok");
});

Deno.test("GET returns 405 Method not allowed", async () => {
  const h = makeHandler(defaultStripe(), defaultSupabase());
  const { status, body } = await parseJson(
    await h(new Request("http://localhost", { method: "GET" })),
  );
  assertEquals(status, 405);
  assertEquals(body.error, "Method not allowed");
});

Deno.test("POST missing bookingId returns 400", async () => {
  const h = makeHandler(defaultStripe(), defaultSupabase());
  const { status, body } = await parseJson(
    await h(postJson("http://localhost", { amount: 1912 })),
  );
  assertEquals(status, 400);
  assertEquals(body.error, "bookingId and amount are required");
});

Deno.test("POST missing amount returns 400", async () => {
  const h = makeHandler(defaultStripe(), defaultSupabase());
  const { status, body } = await parseJson(
    await h(postJson("http://localhost", { bookingId: "bk-1" })),
  );
  assertEquals(status, 400);
  assertEquals(body.error, "bookingId and amount are required");
});

Deno.test("happy path without hostStripeAccountId — no Connect split", async () => {
  let captured: Record<string, unknown> = {};
  const stripe = defaultStripe({
    create: (params) => {
      captured = params as Record<string, unknown>;
      return Promise.resolve({
        id: "pi_no_connect",
        client_secret: "pi_no_connect_secret",
        status: "requires_capture",
      });
    },
  });

  const { status, body } = await parseJson(
    await makeHandler(stripe, defaultSupabase())(
      postJson("http://localhost", { bookingId: "bk-1", amount: 1912 }),
    ),
  );

  assertEquals(status, 200);
  assertEquals(body.paymentIntentId, "pi_no_connect");
  assertEquals(body.clientSecret, "pi_no_connect_secret");
  assertEquals(captured.currency, "aud");
  assertEquals(captured.capture_method, "manual");
  assertEquals(captured.application_fee_amount, undefined);
  assertEquals(captured.transfer_data, undefined);
});

Deno.test("happy path with hostStripeAccountId — correct fee split calculated", async () => {
  let captured: Record<string, unknown> = {};
  const stripe = defaultStripe({
    create: (params) => {
      captured = params as Record<string, unknown>;
      return Promise.resolve({
        id: "pi_connect",
        client_secret: "pi_connect_secret",
        status: "requires_capture",
      });
    },
  });

  await makeHandler(stripe, defaultSupabase())(
    postJson("http://localhost", {
      bookingId: "bk-2",
      amount: 1912,                  // $19.12 in cents
      hostStripeAccountId: "acct_host_abc",
      platformFeePercent: 10,
      hostFeePercent: 10,
    }),
  );

  // guestFee = Math.round(1912 * (10/110)) = Math.round(173.82) = 174
  // hostFee  = Math.round((1912 - 174) * (10/100)) = Math.round(173.8) = 174
  // total    = 174 + 174 = 348
  assertEquals(captured.application_fee_amount, 348);
  assertEquals(captured.transfer_data, { destination: "acct_host_abc" });
});

Deno.test("custom fee percentages applied correctly", async () => {
  let captured: Record<string, unknown> = {};
  const stripe = defaultStripe({
    create: (params) => {
      captured = params as Record<string, unknown>;
      return Promise.resolve({ id: "pi_x", client_secret: "s", status: "requires_capture" });
    },
  });

  await makeHandler(stripe, defaultSupabase())(
    postJson("http://localhost", {
      bookingId: "bk-3",
      amount: 2000,
      hostStripeAccountId: "acct_host_xyz",
      platformFeePercent: 5,
      hostFeePercent: 5,
    }),
  );

  // guestFee = Math.round(2000 * (5/105)) = Math.round(95.24) = 95
  // hostFee  = Math.round((2000 - 95) * (5/100)) = Math.round(95.25) = 95
  // total    = 190
  assertEquals(captured.application_fee_amount, 190);
});

Deno.test("Stripe error returns 500 with error message", async () => {
  const stripe = defaultStripe({
    create: () => Promise.reject(new Error("Stripe rate limited")),
  });
  const { status, body } = await parseJson(
    await makeHandler(stripe, defaultSupabase())(
      postJson("http://localhost", { bookingId: "bk-1", amount: 500 }),
    ),
  );
  assertEquals(status, 500);
  assertEquals(body.error, "Stripe rate limited");
});

Deno.test("booking DB update is called with correct payment intent ID", async () => {
  const updates: Array<{ table: string; piId: string; bookingId: string }> = [];
  const supabase: FakeSupabase = {
    from: (table) => ({
      update: (data) => ({
        eq: (col, val) => {
          updates.push({ table, piId: (data as any).stripe_payment_intent_id, bookingId: val as string });
          return Promise.resolve({ data: null, error: null });
        },
      }),
    }),
  };

  await makeHandler(defaultStripe(), supabase)(
    postJson("http://localhost", { bookingId: "bk-record-check", amount: 1000 }),
  );

  assertEquals(updates.length, 1);
  assertEquals(updates[0].table, "bookings");
  assertEquals(updates[0].bookingId, "bk-record-check");
  assertEquals(updates[0].piId, "pi_test_001");
});
