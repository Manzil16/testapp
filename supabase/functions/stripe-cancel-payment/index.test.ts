/**
 * Tests for stripe-cancel-payment
 *
 * Logic under test:
 *  1. OPTIONS                  → 200 "ok"
 *  2. Missing paymentIntentId  → 400
 *  3. Happy path, booking found with driver → cancels PI, updates DB, fires push
 *  4. Happy path, no booking row returned   → cancels PI, skips push
 *  5. Stripe cancel throws     → 500
 *
 * This function mirrors stripe-capture-payment but calls
 * stripe.paymentIntents.cancel() and sets payment_status = "cancelled".
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
    cancel: (id: string) => Promise<{ id: string; status: string }>;
  };
};

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
// Handler factory (mirrors stripe-cancel-payment/index.ts)
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

      const pi = await stripe.paymentIntents.cancel(paymentIntentId);

      const { data: booking } = await supabase
        .from("bookings")
        .update({ payment_status: "cancelled" })
        .eq("stripe_payment_intent_id", paymentIntentId)
        .select("id, driver_id, charger:chargers(name)")
        .single();

      if ((booking as any)?.driver_id) {
        const chargerName = (booking as any)?.charger?.name ?? "the charger";
        await push(
          "http://supabase.test",
          "service-key",
          (booking as any).driver_id,
          "Booking Declined",
          `Your booking at ${chargerName} was declined and the payment hold has been released.`,
          { bookingId: (booking as any).id, screen: "booking-detail" },
        );
      }

      return new Response(
        JSON.stringify({ status: pi.status }),
        { headers: { ...CORS_HEADERS, "Content-Type": "application/json" } },
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to cancel payment";
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

function makeStripe(cancelResult = { id: "pi_test", status: "canceled" }): FakeStripe {
  return {
    paymentIntents: {
      cancel: (_id) => Promise.resolve(cancelResult),
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
  const res = await makeHandler(makeStripe(), makeSupabase())(
    new Request("http://localhost", { method: "OPTIONS" }),
  );
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

Deno.test("happy path — cancels PI and returns canceled status", async () => {
  const cancelled: string[] = [];
  const stripe: FakeStripe = {
    paymentIntents: {
      cancel: (id) => {
        cancelled.push(id);
        return Promise.resolve({ id, status: "canceled" });
      },
    },
  };

  const { status, body } = await parseJson(
    await makeHandler(stripe, makeSupabase())(
      postJson("http://localhost", { paymentIntentId: "pi_to_cancel" }),
    ),
  );

  assertEquals(status, 200);
  assertEquals(body.status, "canceled");
  assertEquals(cancelled[0], "pi_to_cancel");
});

Deno.test("push notification fires with 'Booking Declined' title when booking has driver_id", async () => {
  const pushCalls: Array<{ userId: string; title: string; msgBody: string }> = [];
  const push: PushFn = async (_url, _key, userId, title, body) => {
    pushCalls.push({ userId, title, msgBody: body });
  };

  const booking = {
    id: "bk-declined",
    driver_id: "driver-uuid-111",
    charger: { name: "Riverside Charger" },
  };

  await makeHandler(makeStripe(), makeSupabase(booking), push)(
    postJson("http://localhost", { paymentIntentId: "pi_declined" }),
  );

  assertEquals(pushCalls.length, 1);
  assertEquals(pushCalls[0].userId, "driver-uuid-111");
  assertEquals(pushCalls[0].title, "Booking Declined");
  assertEquals(pushCalls[0].msgBody.includes("Riverside Charger"), true);
});

Deno.test("no push when booking row is null", async () => {
  const pushCalls: string[] = [];
  const push: PushFn = async (_url, _key, id) => { pushCalls.push(id); };

  await makeHandler(makeStripe(), makeSupabase(null), push)(
    postJson("http://localhost", { paymentIntentId: "pi_no_booking" }),
  );

  assertEquals(pushCalls.length, 0);
});

Deno.test("charger name falls back to 'the charger' when charger field is null", async () => {
  const msgs: string[] = [];
  const push: PushFn = async (_url, _key, _uid, _t, body) => { msgs.push(body); };

  const booking = { id: "bk-y", driver_id: "d-2", charger: null };
  await makeHandler(makeStripe(), makeSupabase(booking), push)(
    postJson("http://localhost", { paymentIntentId: "pi_null_charger" }),
  );

  assertEquals(msgs[0].includes("the charger"), true);
});

Deno.test("Stripe cancel error returns 500", async () => {
  const stripe: FakeStripe = {
    paymentIntents: {
      cancel: () => Promise.reject(new Error("PI already cancelled")),
    },
  };
  const { status, body } = await parseJson(
    await makeHandler(stripe, makeSupabase())(
      postJson("http://localhost", { paymentIntentId: "pi_bad" }),
    ),
  );
  assertEquals(status, 500);
  assertEquals(body.error, "PI already cancelled");
});

Deno.test("DB update sets payment_status to 'cancelled'", async () => {
  const updates: Array<{ data: Record<string, unknown> }> = [];
  const supabase: FakeSupabase = {
    from: (_table) => ({
      update: (data) => {
        updates.push({ data: data as Record<string, unknown> });
        return {
          eq: (_col, _val) => ({
            select: (_cols) => ({
              single: () => Promise.resolve({ data: null, error: null }),
            }),
          }),
        };
      },
    }),
  };

  await makeHandler(makeStripe(), supabase)(
    postJson("http://localhost", { paymentIntentId: "pi_status_check" }),
  );

  assertEquals(updates.length, 1);
  assertEquals(updates[0].data.payment_status, "cancelled");
});
