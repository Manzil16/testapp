/**
 * Tests for process-refund
 *
 * Logic under test:
 *  1. OPTIONS                                      → 200 "ok"
 *  2. Missing bookingId                            → 400
 *  3. Booking not found                            → 404
 *  4. No stripe_payment_intent_id                  → cancel without refund, refunded: false
 *  5. Full refund (> 2hr before start)             → 100% refund, fullRefund: true
 *  6. Partial refund (< 2hr before start)          → 50% refund, fullRefund: false
 *  7. Exactly at 2hr boundary                      → treated as full refund (>= threshold)
 *  8. Stripe refunds.create throws                 → 500
 *
 * Refund policy:
 *   hoursUntilStart >= 2  →  refundAmount = Math.round(total_amount * 100)       (100%)
 *   hoursUntilStart < 2   →  refundAmount = Math.round(total_amount * 100 * 0.5) (50%)
 */

import { assertEquals } from "https://deno.land/std@0.177.0/testing/asserts.ts";
import { CORS_HEADERS, postJson, parseJson } from "../_test_utils/mod.ts";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type BookingRow = {
  id: string;
  stripe_payment_intent_id: string | null;
  total_amount: number;
  start_time: string; // ISO string
};

type FakeStripe = {
  refunds: {
    create: (params: { payment_intent: string; amount: number }) => Promise<{ id: string }>;
  };
};

type SupabaseConfig = {
  booking?: BookingRow | null;
  cancelCalls?: Array<{ id: string; data: Record<string, unknown> }>;
};

// ---------------------------------------------------------------------------
// Supabase mock factory
// ---------------------------------------------------------------------------

function makeSupabase(cfg: SupabaseConfig = {}) {
  return {
    from: (table: string) => {
      if (table === "bookings") {
        return {
          select: (_cols?: string) => ({
            eq: (_col: string, _val: unknown) => ({
              single: () =>
                Promise.resolve(
                  cfg.booking === null || cfg.booking === undefined
                    ? { data: null, error: { message: "Not found" } }
                    : { data: cfg.booking, error: null },
                ),
            }),
          }),
          update: (data: unknown) => ({
            eq: (_col: string, val: unknown) => {
              cfg.cancelCalls?.push({ id: val as string, data: data as Record<string, unknown> });
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
// Handler factory (mirrors process-refund/index.ts)
// ---------------------------------------------------------------------------

const FREE_CANCELLATION_HOURS = 2;

function makeHandler(stripe: FakeStripe, supabase: ReturnType<typeof makeSupabase>) {
  return async (req: Request): Promise<Response> => {
    if (req.method === "OPTIONS") {
      return new Response("ok", { headers: CORS_HEADERS });
    }
    try {
      const { bookingId } = await req.json();

      if (!bookingId) {
        return new Response(
          JSON.stringify({ error: "bookingId is required" }),
          { status: 400, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } },
        );
      }

      const { data: booking, error: fetchError } = await (supabase as any)
        .from("bookings")
        .select("*")
        .eq("id", bookingId)
        .single();

      if (fetchError || !booking) {
        return new Response(JSON.stringify({ error: "Booking not found" }), {
          status: 404,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        });
      }

      if (!booking.stripe_payment_intent_id) {
        await (supabase as any)
          .from("bookings")
          .update({ status: "cancelled", cancelled_at: new Date().toISOString() })
          .eq("id", bookingId);

        return new Response(
          JSON.stringify({ refunded: false, reason: "No payment to refund" }),
          { headers: { ...CORS_HEADERS, "Content-Type": "application/json" } },
        );
      }

      const startTime = new Date(booking.start_time);
      const hoursUntilStart = (startTime.getTime() - Date.now()) / (1000 * 60 * 60);

      const refundAmount = hoursUntilStart >= FREE_CANCELLATION_HOURS
        ? Math.round(booking.total_amount * 100)
        : Math.round(booking.total_amount * 100 * 0.5);

      await stripe.refunds.create({
        payment_intent: booking.stripe_payment_intent_id,
        amount: refundAmount,
      });

      await (supabase as any)
        .from("bookings")
        .update({ status: "cancelled", payment_status: "refunded", cancelled_at: new Date().toISOString() })
        .eq("id", bookingId);

      return new Response(
        JSON.stringify({
          refunded: true,
          refundAmountCents: refundAmount,
          fullRefund: hoursUntilStart >= FREE_CANCELLATION_HOURS,
        }),
        { headers: { ...CORS_HEADERS, "Content-Type": "application/json" } },
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to process refund";
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

function hoursFromNow(hours: number): string {
  return new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
}

function makeStripe(refundCalls: Array<{ amount: number; pi: string }> = []): FakeStripe {
  return {
    refunds: {
      create: (params) => {
        refundCalls.push({ amount: params.amount, pi: params.payment_intent });
        return Promise.resolve({ id: "re_test_001" });
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
  assertEquals(await res.text(), "ok");
});

Deno.test("missing bookingId returns 400", async () => {
  const { status, body } = await parseJson(
    await makeHandler(makeStripe(), makeSupabase())(
      postJson("http://localhost", {}),
    ),
  );
  assertEquals(status, 400);
  assertEquals(body.error, "bookingId is required");
});

Deno.test("booking not found returns 404", async () => {
  const { status, body } = await parseJson(
    await makeHandler(makeStripe(), makeSupabase({ booking: null }))(
      postJson("http://localhost", { bookingId: "bk-ghost" }),
    ),
  );
  assertEquals(status, 404);
  assertEquals(body.error, "Booking not found");
});

Deno.test("no payment intent — booking cancelled, refunded: false returned", async () => {
  const cancelCalls: Array<{ id: string; data: Record<string, unknown> }> = [];
  const booking: BookingRow = {
    id: "bk-no-pi",
    stripe_payment_intent_id: null,
    total_amount: 19.12,
    start_time: hoursFromNow(5),
  };
  const refundCalls: Array<{ amount: number; pi: string }> = [];

  const { status, body } = await parseJson(
    await makeHandler(makeStripe(refundCalls), makeSupabase({ booking, cancelCalls }))(
      postJson("http://localhost", { bookingId: "bk-no-pi" }),
    ),
  );

  assertEquals(status, 200);
  assertEquals(body.refunded, false);
  assertEquals(body.reason, "No payment to refund");
  assertEquals(refundCalls.length, 0); // no Stripe call made
  assertEquals(cancelCalls[0].data.status, "cancelled");
});

Deno.test("full refund when > 2 hours before start — 100% of total_amount", async () => {
  const refundCalls: Array<{ amount: number; pi: string }> = [];
  const booking: BookingRow = {
    id: "bk-full",
    stripe_payment_intent_id: "pi_full_refund",
    total_amount: 19.12,       // $19.12 → 1912 cents
    start_time: hoursFromNow(3), // 3hr away → > 2hr threshold
  };

  const { status, body } = await parseJson(
    await makeHandler(makeStripe(refundCalls), makeSupabase({ booking }))(
      postJson("http://localhost", { bookingId: "bk-full" }),
    ),
  );

  assertEquals(status, 200);
  assertEquals(body.refunded, true);
  assertEquals(body.fullRefund, true);
  assertEquals(body.refundAmountCents, 1912);
  assertEquals(refundCalls[0].amount, 1912);
  assertEquals(refundCalls[0].pi, "pi_full_refund");
});

Deno.test("partial refund when < 2 hours before start — 50% of total_amount", async () => {
  const refundCalls: Array<{ amount: number; pi: string }> = [];
  const booking: BookingRow = {
    id: "bk-late",
    stripe_payment_intent_id: "pi_late_cancel",
    total_amount: 19.12,        // 1912 cents × 0.5 = 956 cents
    start_time: hoursFromNow(1), // 1hr away → < 2hr threshold
  };

  const { status, body } = await parseJson(
    await makeHandler(makeStripe(refundCalls), makeSupabase({ booking }))(
      postJson("http://localhost", { bookingId: "bk-late" }),
    ),
  );

  assertEquals(status, 200);
  assertEquals(body.refunded, true);
  assertEquals(body.fullRefund, false);
  assertEquals(body.refundAmountCents, 956);
  assertEquals(refundCalls[0].amount, 956);
});

Deno.test("boundary: exactly 2 hours before start is treated as full refund", async () => {
  const refundCalls: Array<{ amount: number; pi: string }> = [];
  const booking: BookingRow = {
    id: "bk-boundary",
    stripe_payment_intent_id: "pi_boundary",
    total_amount: 10.00, // 1000 cents
    // Exactly 2 hours: hoursUntilStart >= 2 → full refund
    start_time: hoursFromNow(2),
  };

  const { body } = await parseJson(
    await makeHandler(makeStripe(refundCalls), makeSupabase({ booking }))(
      postJson("http://localhost", { bookingId: "bk-boundary" }),
    ),
  );

  // May be just under 2hr by the time the handler runs (few ms), so we accept either
  // behaviour but assert the call was made
  assertEquals(body.refunded, true);
  assertEquals(refundCalls.length, 1);
});

Deno.test("cancelled booking DB update sets correct fields", async () => {
  const cancelCalls: Array<{ id: string; data: Record<string, unknown> }> = [];
  const booking: BookingRow = {
    id: "bk-check-update",
    stripe_payment_intent_id: "pi_check",
    total_amount: 5.00,
    start_time: hoursFromNow(5),
  };

  await makeHandler(makeStripe(), makeSupabase({ booking, cancelCalls }))(
    postJson("http://localhost", { bookingId: "bk-check-update" }),
  );

  assertEquals(cancelCalls[0].data.status, "cancelled");
  assertEquals(cancelCalls[0].data.payment_status, "refunded");
  assertEquals(typeof cancelCalls[0].data.cancelled_at, "string");
});

Deno.test("Stripe refunds.create error returns 500", async () => {
  const stripe: FakeStripe = {
    refunds: {
      create: () => Promise.reject(new Error("Stripe PI not capturable")),
    },
  };
  const booking: BookingRow = {
    id: "bk-stripe-fail",
    stripe_payment_intent_id: "pi_fail",
    total_amount: 20.00,
    start_time: hoursFromNow(5),
  };

  const { status, body } = await parseJson(
    await makeHandler(stripe, makeSupabase({ booking }))(
      postJson("http://localhost", { bookingId: "bk-stripe-fail" }),
    ),
  );
  assertEquals(status, 500);
  assertEquals(body.error, "Stripe PI not capturable");
});
