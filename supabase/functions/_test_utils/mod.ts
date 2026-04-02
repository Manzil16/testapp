/**
 * Shared test utilities for VehicleGrid edge function unit tests.
 *
 * Strategy: each edge function is re-implemented as a `makeHandler(deps)` factory
 * in its own test file. This lets us inject mock Stripe/Supabase objects and test
 * every logic branch without starting a real HTTP server or touching live APIs.
 *
 * Run all tests:
 *   deno test supabase/functions --allow-env
 *
 * Run one function:
 *   deno test supabase/functions/stripe-create-payment/index.test.ts --allow-env
 */

export const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

/** Build a POST Request with a JSON body. */
export function postJson(url: string, body: unknown): Request {
  return new Request(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

/** Parse the response body as JSON and return it alongside the status code. */
export async function parseJson(
  res: Response,
): Promise<{ status: number; body: Record<string, unknown> }> {
  return { status: res.status, body: await res.json() };
}

/** No-op push notification stub — push should never block core logic. */
export const noopPush = async (
  _url: string,
  _key: string,
  _userId: string,
  _title: string,
  _body: string,
  _data?: Record<string, unknown>,
): Promise<void> => {};
