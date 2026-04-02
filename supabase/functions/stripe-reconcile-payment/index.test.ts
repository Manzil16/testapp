/**
 * Tests for stripe-reconcile-payment
 *
 * Logic under test:
 *  1. OPTIONS                        → 200 "ok"
 *  2. Non-POST                       → 405
 *  3. Missing bookingId              → 400
 *  4. Missing actualKwh              → 400
 *  5. actualKwh = 0 (edge case)      → valid, $0 charged
 *  6. Booking not found              → 404
 *  7. No stripe_payment_intent_id    → 400
 *  8. Happy path — default 10% fees  → correct math
 *  9. Happy path — fees from config  → config value used instead of default
 * 10. DB update error                → 500
 *
 * Key math (10% platform fee, 10% host fee):
 *   actualKwh=31.6 @ pricePerKwh=0.55
 *   actualSubtotal = 31.6 × 0.55       = 17.38
 *   platformFee    = 17.38 × 0.10      =  1.738
 *   actualTotal    = 17.38 + 1.738     = 19.118  → rounds to 19.12  (1912 cents)
 *   hostPayout     = 17.38 × 0.90      = 15.642  → rounds to 15.64
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

type BookingRow = {
  id: string;
  driver_id: string | null;
  host_id: string | null;
  stripe_payment_intent_id: string | null;
  charger: { price_per_kwh: string };
};

type FakeStripe = {
  paymentIntents: {
    capture: (id: string, params: { amount_to_capture: number }) => Promise<{ id: string; status: string }>;
  };
};

// Supabase mock must serve two different tables: bookings + platform_config + platform_events
type SupabaseConfig = {
  booking?: BookingRow | null;
  bookingFetchError?: { message: string } | null;
  platformFeeConfig?: { value: string } | null;
  hostFeeConfig?: { value: string } | null;
  updateError?: { message: string } | null;
};

// ---------------------------------------------------------------------------
// Supabase mock factory
// ---------------------------------------------------------------------------

function makeSupabase(cfg: SupabaseConfig = {}) {
  // Each call to .from() builds a fresh chainable mock
  return {
    from: (table: string) => {
      if (table === "bookings") {
        return {
          select: (_cols?: string) => ({
            eq: (_col: string, _val: unknown) => ({
              single: () =>
                Promise.resolve(
                  cfg.booking === null || cfg.bookingFetchError
                    ? { data: null, error: cfg.bookingFetchError ?? { message: "Not found" } }
                    : { data: cfg.booking ?? null, error: null },
                ),
            }),
          }),
          update: (_data: unknown) => ({
            eq: (_col: string, _val: unknown) =>
              Promise.resolve({ data: null, error: cfg.updateError ?? null }),
          }),
        };
      }

      if (table === "platform_config") {
        // Called twice: once for platform_fee_percent, once for host_fee_percent
        let callCount = 0;
        return {
          select: (_cols?: string) => ({
            eq: (_col: string, _val: unknown) => ({
              single: () => {
                callCount++;
                if (callCount === 1) {
                  return Promise.resolve({
                    data: cfg.platformFeeConfig ?? null,
                    error: null,
                  });
                }
                return Promise.resolve({
                  data: cfg.hostFeeConfig ?? null,
                  error: null,
                });
              },
            }),
          }),
        };
      }

      if (table === "platform_events") {
        return {
          insert: (_data: unknown) => Promise.resolve({ data: null, error: null }),
        };
      }

      return {};
    },
  };
}

// ---------------------------------------------------------------------------
// Handler factory (mirrors stripe-reconcile-payment/index.ts)
// ---------------------------------------------------------------------------

function makeHandler(stripe: FakeStripe, supabase: ReturnType<typeof makeSupabase>, push: PushFn = noopPush) {
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
      const { bookingId, actualKwh } = await req.json();

      if (!bookingId || actualKwh === undefined || actualKwh === null) {
        return new Response(
          JSON.stringify({ error: "bookingId and actualKwh are required" }),
          { status: 400, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } },
        );
      }

      const { data: booking, error: bookingError } = await (supabase as any)
        .from("bookings")
        .select("*, charger:chargers(price_per_kwh)")
        .eq("id", bookingId)
        .single();

      if (bookingError || !booking) {
        return new Response(JSON.stringify({ error: "Booking not found" }), {
          status: 404,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        });
      }

      if (!booking.stripe_payment_intent_id) {
        return new Response(
          JSON.stringify({ error: "No payment intent associated with this booking" }),
          { status: 400, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } },
        );
      }

      const { data: feeConfig } = await (supabase as any)
        .from("platform_config")
        .select("value")
        .eq("key", "platform_fee_percent")
        .single();

      const platformFeePercent = feeConfig ? parseFloat(feeConfig.value) : 10;

      const { data: hostFeeConfig } = await (supabase as any)
        .from("platform_config")
        .select("value")
        .eq("key", "host_fee_percent")
        .single();

      const hostFeePercent = hostFeeConfig ? parseFloat(hostFeeConfig.value) : 10;

      const pricePerKwh = parseFloat(booking.charger.price_per_kwh);
      const actualSubtotal = actualKwh * pricePerKwh;
      const platformFee = actualSubtotal * (platformFeePercent / 100);
      const actualTotal = actualSubtotal + platformFee;
      const hostPayout = actualSubtotal * (1 - hostFeePercent / 100);
      const amountCents = Math.round(actualTotal * 100);

      await stripe.paymentIntents.capture(booking.stripe_payment_intent_id, {
        amount_to_capture: amountCents,
      });

      const { error: updateError } = await (supabase as any)
        .from("bookings")
        .update({
          actual_kwh: actualKwh,
          actual_amount: actualTotal,
          host_payout_amount: hostPayout,
          status: "completed",
          session_ended_at: new Date().toISOString(),
        })
        .eq("id", bookingId);

      if (updateError) {
        return new Response(
          JSON.stringify({ error: "Failed to update booking: " + updateError.message }),
          { status: 500, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } },
        );
      }

      if (booking.driver_id) {
        await push("", "", booking.driver_id, "Session Complete",
          `Charging session finished. ${actualKwh.toFixed(1)} kWh used — $${actualTotal.toFixed(2)} charged.`,
          { bookingId, screen: "booking-detail" });
      }

      if (booking.host_id) {
        await push("", "", booking.host_id, "Session Complete — Payout Incoming",
          `Charging session finished. You'll receive $${hostPayout.toFixed(2)} for ${actualKwh.toFixed(1)} kWh delivered.`,
          { bookingId, screen: "host-booking-detail" });
      }

      await (supabase as any).from("platform_events").insert({
        event_type: "payment.captured",
        actor_role: "system",
        target_type: "booking",
        target_id: bookingId,
        amount_cents: amountCents,
        kwh: actualKwh,
        metadata: {},
      });

      return new Response(
        JSON.stringify({
          ok: true,
          actualTotal: Math.round(actualTotal * 100) / 100,
          hostPayout: Math.round(hostPayout * 100) / 100,
        }),
        { headers: { ...CORS_HEADERS, "Content-Type": "application/json" } },
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to reconcile payment";
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

const ACTIVE_BOOKING: BookingRow = {
  id: "bk-active",
  driver_id: "driver-uuid",
  host_id: "host-uuid",
  stripe_payment_intent_id: "pi_reconcile_me",
  charger: { price_per_kwh: "0.55" },
};

function makeStripe(capturedAmounts: number[] = []): FakeStripe {
  return {
    paymentIntents: {
      capture: (_id, params) => {
        capturedAmounts.push(params.amount_to_capture);
        return Promise.resolve({ id: _id, status: "succeeded" });
      },
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
});

Deno.test("GET returns 405", async () => {
  const { status } = await parseJson(
    await makeHandler(makeStripe(), makeSupabase())(
      new Request("http://localhost", { method: "GET" }),
    ),
  );
  assertEquals(status, 405);
});

Deno.test("missing bookingId returns 400", async () => {
  const { status, body } = await parseJson(
    await makeHandler(makeStripe(), makeSupabase())(
      postJson("http://localhost", { actualKwh: 10 }),
    ),
  );
  assertEquals(status, 400);
  assertEquals(body.error, "bookingId and actualKwh are required");
});

Deno.test("missing actualKwh returns 400", async () => {
  const { status } = await parseJson(
    await makeHandler(makeStripe(), makeSupabase())(
      postJson("http://localhost", { bookingId: "bk-1" }),
    ),
  );
  assertEquals(status, 400);
});

Deno.test("actualKwh = 0 is valid — zero charge processed", async () => {
  const capturedAmounts: number[] = [];
  const { status, body } = await parseJson(
    await makeHandler(
      makeStripe(capturedAmounts),
      makeSupabase({ booking: ACTIVE_BOOKING }),
    )(postJson("http://localhost", { bookingId: "bk-active", actualKwh: 0 })),
  );
  assertEquals(status, 200);
  assertEquals(body.actualTotal, 0);
  assertEquals(body.hostPayout, 0);
  assertEquals(capturedAmounts[0], 0);
});

Deno.test("booking not found returns 404", async () => {
  const { status, body } = await parseJson(
    await makeHandler(makeStripe(), makeSupabase({ booking: null }))(
      postJson("http://localhost", { bookingId: "bk-ghost", actualKwh: 10 }),
    ),
  );
  assertEquals(status, 404);
  assertEquals(body.error, "Booking not found");
});

Deno.test("booking with no stripe_payment_intent_id returns 400", async () => {
  const booking = { ...ACTIVE_BOOKING, stripe_payment_intent_id: null };
  const { status, body } = await parseJson(
    await makeHandler(makeStripe(), makeSupabase({ booking: booking as any }))(
      postJson("http://localhost", { bookingId: "bk-no-pi", actualKwh: 10 }),
    ),
  );
  assertEquals(status, 400);
  assertEquals(body.error, "No payment intent associated with this booking");
});

Deno.test("happy path — correct amounts with default 10/10 fees (31.6 kWh @ $0.55)", async () => {
  const capturedAmounts: number[] = [];

  const { status, body } = await parseJson(
    await makeHandler(
      makeStripe(capturedAmounts),
      makeSupabase({ booking: ACTIVE_BOOKING }),
    )(postJson("http://localhost", { bookingId: "bk-active", actualKwh: 31.6 })),
  );

  assertEquals(status, 200);
  // actualSubtotal = 31.6 × 0.55 = 17.38
  // platformFee    = 17.38 × 0.10 = 1.738
  // actualTotal    = 19.118 → 19.12
  // hostPayout     = 17.38 × 0.90 = 15.642 → 15.64
  assertEquals(body.actualTotal, 19.12);
  assertEquals(body.hostPayout, 15.64);
  assertEquals(capturedAmounts[0], 1912); // cents
});

Deno.test("happy path — fee percentages read from platform_config when present", async () => {
  const capturedAmounts: number[] = [];

  const { status, body } = await parseJson(
    await makeHandler(
      makeStripe(capturedAmounts),
      makeSupabase({
        booking: ACTIVE_BOOKING,
        platformFeeConfig: { value: "15" }, // 15% platform fee
        hostFeeConfig: { value: "12" },     // 12% host fee
      }),
    )(postJson("http://localhost", { bookingId: "bk-active", actualKwh: 10 })),
  );

  assertEquals(status, 200);
  // actualSubtotal = 10 × 0.55 = 5.50
  // platformFee    = 5.50 × 0.15 = 0.825
  // actualTotal    = 6.325 → 6.33 (Math.round(632.5) / 100 = 633/100 = 6.33)
  // hostPayout     = 5.50 × 0.88 = 4.84
  assertEquals(body.actualTotal, 6.33);
  assertEquals(body.hostPayout, 4.84);
  assertEquals(capturedAmounts[0], 633);
});

Deno.test("DB update error returns 500", async () => {
  const { status, body } = await parseJson(
    await makeHandler(
      makeStripe(),
      makeSupabase({
        booking: ACTIVE_BOOKING,
        updateError: { message: "update constraint violation" },
      }),
    )(postJson("http://localhost", { bookingId: "bk-active", actualKwh: 5 })),
  );
  assertEquals(status, 500);
  assertEquals((body.error as string).includes("update constraint violation"), true);
});

Deno.test("push notifications sent to both driver and host", async () => {
  const pushCalls: Array<{ userId: string; title: string }> = [];
  const push: PushFn = async (_u, _k, userId, title) => { pushCalls.push({ userId, title }); };

  await makeHandler(makeStripe(), makeSupabase({ booking: ACTIVE_BOOKING }), push)(
    postJson("http://localhost", { bookingId: "bk-active", actualKwh: 20 }),
  );

  assertEquals(pushCalls.length, 2);
  assertEquals(pushCalls.find((p) => p.userId === "driver-uuid")?.title, "Session Complete");
  assertEquals(
    pushCalls.find((p) => p.userId === "host-uuid")?.title,
    "Session Complete — Payout Incoming",
  );
});
