/**
 * Tests for stripe-webhook
 *
 * Logic under test:
 *  1. Missing stripe-signature header           → 400
 *  2. constructEvent throws (invalid signature)  → 400
 *  3. payment_intent.succeeded                   → update payment_status = "captured"
 *  4. payment_intent.payment_failed              → update payment_status = "failed", status = "cancelled"
 *  5. payment_intent.canceled                    → update payment_status = "cancelled"
 *  6. charge.refunded with payment_intent field  → update payment_status = "refunded"
 *  7. charge.refunded without payment_intent     → no DB update, returns 200
 *  8. Unknown event type                         → acknowledged, no DB update, returns 200
 *
 * NOTE: This function does NOT use CORS headers (it's a server-to-server Stripe webhook).
 */

import { assertEquals } from "https://deno.land/std@0.177.0/testing/asserts.ts";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type StripeEvent = {
  type: string;
  data: {
    object: Record<string, unknown>;
  };
};

type FakeStripe = {
  webhooks: {
    constructEvent: (body: string, signature: string, secret: string) => StripeEvent;
  };
};

// Supabase mock tracks all calls: .from(t).update(d).eq(c,v)
type UpdateCall = { table: string; data: Record<string, unknown>; col: string; val: unknown };

function makeSupabase(calls: UpdateCall[] = []) {
  return {
    from: (table: string) => ({
      update: (data: unknown) => ({
        eq: (col: string, val: unknown) => {
          calls.push({ table, data: data as Record<string, unknown>, col, val });
          return Promise.resolve({ data: null, error: null });
        },
      }),
    }),
  };
}

// ---------------------------------------------------------------------------
// Handler factory (mirrors stripe-webhook/index.ts)
// ---------------------------------------------------------------------------

function makeHandler(stripe: FakeStripe, supabase: ReturnType<typeof makeSupabase>) {
  return async (req: Request): Promise<Response> => {
    const body = await req.text();
    const signature = req.headers.get("stripe-signature");

    if (!signature) {
      return new Response(
        JSON.stringify({ error: "Missing stripe-signature header" }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    let event: StripeEvent;
    try {
      event = stripe.webhooks.constructEvent(body, signature, "whsec_test");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Signature error";
      return new Response(
        JSON.stringify({ error: `Webhook signature verification failed: ${msg}` }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    switch (event.type) {
      case "payment_intent.succeeded": {
        const pi = event.data.object;
        await supabase.from("bookings").update({ payment_status: "captured" })
          .eq("stripe_payment_intent_id", pi.id as string);
        break;
      }
      case "payment_intent.payment_failed": {
        const pi = event.data.object;
        await supabase.from("bookings")
          .update({ payment_status: "failed", status: "cancelled" })
          .eq("stripe_payment_intent_id", pi.id as string);
        break;
      }
      case "payment_intent.canceled": {
        const pi = event.data.object;
        await supabase.from("bookings").update({ payment_status: "cancelled" })
          .eq("stripe_payment_intent_id", pi.id as string);
        break;
      }
      case "charge.refunded": {
        const charge = event.data.object;
        if (charge.payment_intent) {
          await supabase.from("bookings").update({ payment_status: "refunded" })
            .eq("stripe_payment_intent_id", charge.payment_intent as string);
        }
        break;
      }
      default:
        break;
    }

    return new Response(
      JSON.stringify({ received: true }),
      { headers: { "Content-Type": "application/json" } },
    );
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function webhookRequest(event: StripeEvent, signature = "valid-sig"): Request {
  return new Request("http://localhost/stripe-webhook", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "stripe-signature": signature,
    },
    body: JSON.stringify(event),
  });
}

function makeStripe(returnEvent?: StripeEvent): FakeStripe {
  return {
    webhooks: {
      constructEvent: (body, _sig, _secret) => {
        if (returnEvent) return returnEvent;
        return JSON.parse(body) as StripeEvent;
      },
    },
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

Deno.test("missing stripe-signature header returns 400", async () => {
  const calls: UpdateCall[] = [];
  const h = makeHandler(makeStripe(), makeSupabase(calls));
  const res = await h(
    new Request("http://localhost", {
      method: "POST",
      body: "{}",
      // no stripe-signature header
    }),
  );
  assertEquals(res.status, 400);
  const body = await res.json();
  assertEquals(body.error, "Missing stripe-signature header");
  assertEquals(calls.length, 0);
});

Deno.test("invalid signature causes constructEvent to throw — returns 400", async () => {
  const stripe: FakeStripe = {
    webhooks: {
      constructEvent: () => {
        throw new Error("No matching signature found");
      },
    },
  };
  const res = await makeHandler(stripe, makeSupabase())(
    new Request("http://localhost", {
      method: "POST",
      headers: { "stripe-signature": "bad-sig" },
      body: "{}",
    }),
  );
  assertEquals(res.status, 400);
  const body = await res.json();
  assertEquals((body.error as string).includes("No matching signature found"), true);
});

Deno.test("payment_intent.succeeded updates payment_status to captured", async () => {
  const calls: UpdateCall[] = [];
  const event: StripeEvent = {
    type: "payment_intent.succeeded",
    data: { object: { id: "pi_succeeded_001" } },
  };

  const res = await makeHandler(makeStripe(event), makeSupabase(calls))(
    webhookRequest(event),
  );

  assertEquals(res.status, 200);
  assertEquals((await res.json()).received, true);
  assertEquals(calls.length, 1);
  assertEquals(calls[0].data.payment_status, "captured");
  assertEquals(calls[0].val, "pi_succeeded_001");
});

Deno.test("payment_intent.payment_failed updates status to failed + cancelled", async () => {
  const calls: UpdateCall[] = [];
  const event: StripeEvent = {
    type: "payment_intent.payment_failed",
    data: { object: { id: "pi_failed_002" } },
  };

  await makeHandler(makeStripe(event), makeSupabase(calls))(webhookRequest(event));

  assertEquals(calls.length, 1);
  assertEquals(calls[0].data.payment_status, "failed");
  assertEquals(calls[0].data.status, "cancelled");
  assertEquals(calls[0].val, "pi_failed_002");
});

Deno.test("payment_intent.canceled updates payment_status to cancelled", async () => {
  const calls: UpdateCall[] = [];
  const event: StripeEvent = {
    type: "payment_intent.canceled",
    data: { object: { id: "pi_canceled_003" } },
  };

  await makeHandler(makeStripe(event), makeSupabase(calls))(webhookRequest(event));

  assertEquals(calls.length, 1);
  assertEquals(calls[0].data.payment_status, "cancelled");
  assertEquals(calls[0].val, "pi_canceled_003");
});

Deno.test("charge.refunded with payment_intent updates payment_status to refunded", async () => {
  const calls: UpdateCall[] = [];
  const event: StripeEvent = {
    type: "charge.refunded",
    data: { object: { id: "ch_004", payment_intent: "pi_behind_charge_004" } },
  };

  await makeHandler(makeStripe(event), makeSupabase(calls))(webhookRequest(event));

  assertEquals(calls.length, 1);
  assertEquals(calls[0].data.payment_status, "refunded");
  assertEquals(calls[0].val, "pi_behind_charge_004");
});

Deno.test("charge.refunded without payment_intent does not update DB", async () => {
  const calls: UpdateCall[] = [];
  const event: StripeEvent = {
    type: "charge.refunded",
    data: { object: { id: "ch_no_pi" } }, // no payment_intent field
  };

  const res = await makeHandler(makeStripe(event), makeSupabase(calls))(webhookRequest(event));

  assertEquals(res.status, 200);
  assertEquals(calls.length, 0);
});

Deno.test("unknown event type is acknowledged without DB update", async () => {
  const calls: UpdateCall[] = [];
  const event: StripeEvent = {
    type: "customer.subscription.created",
    data: { object: { id: "sub_unknown" } },
  };

  const res = await makeHandler(makeStripe(event), makeSupabase(calls))(webhookRequest(event));

  assertEquals(res.status, 200);
  assertEquals((await res.json()).received, true);
  assertEquals(calls.length, 0);
});

Deno.test("each event type updates the correct table and column", async () => {
  const events: Array<{ type: string; piId: string }> = [
    { type: "payment_intent.succeeded", piId: "pi_s" },
    { type: "payment_intent.payment_failed", piId: "pi_f" },
    { type: "payment_intent.canceled", piId: "pi_c" },
  ];

  for (const { type, piId } of events) {
    const calls: UpdateCall[] = [];
    const event: StripeEvent = { type, data: { object: { id: piId } } };
    await makeHandler(makeStripe(event), makeSupabase(calls))(webhookRequest(event));
    assertEquals(calls[0].table, "bookings");
    assertEquals(calls[0].col, "stripe_payment_intent_id");
  }
});
