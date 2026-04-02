/**
 * Tests for stripe-capture-payment
 *
 * Logic under test:
 *  1. OPTIONS                  → 200 "ok"
 *  2. Missing paymentIntentId  → 400
 *  3. Happy path, booking found with driver → captures PI, updates DB, fires push
 *  4. Happy path, no booking row returned   → captures PI, skips push (no driver_id)
 *  5. Stripe capture throws    → 500
 */

import { assertEquals } from "https://deno.land/std@0.177.0/testing/asserts.ts";
import { CORS_HEADERS, postJson, parseJson, noopPush } from "../_test_utils/mod.ts";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type PushFn = (
  url: string,
  key: string,
  userId: string,
  title: string,
  body: string,
  data?: Record<string, unknown>,
) => Promise<void>;

type FakeStripe = {
  paymentIntents: {
    capture: (id: string) => Promise<{ id: string; status: string }>;
  };
};

// Supabase mock must support:
//   .from("bookings").update(x).eq(x,x).select(x).single()
type FakeSupabase = {
  from: (table: string) => {
    update: (data: unknown) => {
      eq: (col: string, val: unknown) => {
        select: (cols: string) => {
          single: () => Promise<{ data: unknown; error: null }>;
        };
      };
    };
  };
};

// ---------------------------------------------------------------------------
// Handler factory (mirrors stripe-capture-payment/index.ts)
// ---------------------------------------------------------------------------

function makeHandler(stripe: FakeStripe, supabase: FakeSupabase, push: PushFn = noopPush) {
  return async (req: Request): Promise<Response> => {
    if (req.method === "OPTIONS") {
      return new Response("ok", { headers: CORS_HEADERS });
    }
    try {
      const { paymentIntentId } = await req.json();
      if (!paymentIntentId) {
        return new Response(
          JSON.stringify({ error: "paymentIntentId is required" }),
          { status: 400, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } },
        );
      }

      const pi = await stripe.paymentIntents.capture(paymentIntentId);

      const { data: booking } = await supabase
        .from("bookings")
        .update({ payment_status: "captured" })
        .eq("stripe_payment_intent_id", paymentIntentId)
        .select("id, driver_id, charger:chargers(name)")
        .single();

      if ((booking as any)?.driver_id) {
        const chargerName = (booking as any)?.charger?.name ?? "your charger";
        await push(
          "http://supabase.test",
          "service-key",
          (booking as any).driver_id,
          "Booking Approved!",
          `Your booking at ${chargerName} has been confirmed and payment authorized.`,
          { bookingId: (booking as any).id, screen: "booking-detail" },
        );
      }

      return new Response(
        JSON.stringify({ status: pi.status }),
        { headers: { ...CORS_HEADERS, "Content-Type": "application/json" } },
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to capture payment";
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

function makeStripe(captureResult = { id: "pi_test", status: "succeeded" }): FakeStripe {
  return {
    paymentIntents: {
      capture: (_id) => Promise.resolve(captureResult),
    },
  };
}

function makeSupabase(bookingData: unknown = null): FakeSupabase {
  return {
    from: (_table) => ({
      update: (_data) => ({
        eq: (_col, _val) => ({
          select: (_cols) => ({
            single: () => Promise.resolve({ data: bookingData, error: null }),
          }),
        }),
      }),
    }),
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

Deno.test("OPTIONS returns 200 ok", async () => {
  const h = makeHandler(makeStripe(), makeSupabase());
  const res = await h(new Request("http://localhost", { method: "OPTIONS" }));
  assertEquals(res.status, 200);
  assertEquals(await res.text(), "ok");
});

Deno.test("missing paymentIntentId returns 400", async () => {
  const { status, body } = await parseJson(
    await makeHandler(makeStripe(), makeSupabase())(
      postJson("http://localhost", {}),
    ),
  );
  assertEquals(status, 400);
  assertEquals(body.error, "paymentIntentId is required");
});

Deno.test("happy path — captures PI and returns status", async () => {
  const captured: string[] = [];
  const stripe: FakeStripe = {
    paymentIntents: {
      capture: (id) => {
        captured.push(id);
        return Promise.resolve({ id, status: "succeeded" });
      },
    },
  };

  const { status, body } = await parseJson(
    await makeHandler(stripe, makeSupabase())(
      postJson("http://localhost", { paymentIntentId: "pi_capture_me" }),
    ),
  );

  assertEquals(status, 200);
  assertEquals(body.status, "succeeded");
  assertEquals(captured[0], "pi_capture_me");
});

Deno.test("push notification sent to driver when booking row has driver_id", async () => {
  const pushCalls: Array<{ userId: string; title: string }> = [];
  const push: PushFn = async (_url, _key, userId, title) => {
    pushCalls.push({ userId, title });
  };

  const booking = {
    id: "bk-notify",
    driver_id: "driver-uuid-999",
    charger: { name: "Manzil's Level 2" },
  };

  await makeHandler(makeStripe(), makeSupabase(booking), push)(
    postJson("http://localhost", { paymentIntentId: "pi_with_driver" }),
  );

  assertEquals(pushCalls.length, 1);
  assertEquals(pushCalls[0].userId, "driver-uuid-999");
  assertEquals(pushCalls[0].title, "Booking Approved!");
});

Deno.test("no push notification when booking row has no driver_id", async () => {
  const pushCalls: string[] = [];
  const push: PushFn = async (_url, _key, userId) => { pushCalls.push(userId); };

  // Booking without driver_id (null booking row)
  await makeHandler(makeStripe(), makeSupabase(null), push)(
    postJson("http://localhost", { paymentIntentId: "pi_no_driver" }),
  );

  assertEquals(pushCalls.length, 0);
});

Deno.test("charger name falls back to 'your charger' when charger is null", async () => {
  const pushBodies: string[] = [];
  const push: PushFn = async (_url, _key, _uid, _title, body) => { pushBodies.push(body); };

  const booking = { id: "bk-x", driver_id: "d-1", charger: null };
  await makeHandler(makeStripe(), makeSupabase(booking), push)(
    postJson("http://localhost", { paymentIntentId: "pi_no_charger" }),
  );

  assertEquals(pushBodies[0].includes("your charger"), true);
});

Deno.test("Stripe capture error returns 500", async () => {
  const stripe: FakeStripe = {
    paymentIntents: {
      capture: () => Promise.reject(new Error("PI already captured")),
    },
  };
  const { status, body } = await parseJson(
    await makeHandler(stripe, makeSupabase())(
      postJson("http://localhost", { paymentIntentId: "pi_already_done" }),
    ),
  );
  assertEquals(status, 500);
  assertEquals(body.error, "PI already captured");
});
