import { supabase } from "../lib/supabase";
import { AppConfig } from "../constants/app";

export class StripeNotConfiguredError extends Error {
  constructor() {
    super("Stripe is not configured. Enter your test credentials to continue.");
    this.name = "StripeNotConfiguredError";
  }
}

export function isStripeNotConfiguredError(err: unknown): err is StripeNotConfiguredError {
  return err instanceof StripeNotConfiguredError;
}

export interface StripeOnboardingResult {
  accountId: string;
  onboardingUrl: string;
}

export interface PaymentIntentResult {
  clientSecret: string;
  paymentIntentId: string;
  card?: {
    brand?: string;
    last4?: string;
  };
}

export interface PaymentSetupStatusResult {
  paymentMethodAdded: boolean;
  paymentMethodCount: number;
  card?: {
    brand?: string;
    last4?: string;
  };
  customerId?: string;
}

async function extractFunctionErrorMessage(err: unknown, fallback: string): Promise<string> {
  if (!(err instanceof Error)) {
    return fallback;
  }

  let message = err.message || fallback;
  const errorWithContext = err as Error & {
    context?: {
      json?: () => Promise<{ error?: unknown }>;
      text?: () => Promise<string>;
    };
  };

  if (errorWithContext.context?.json) {
    try {
      const body = await errorWithContext.context.json();
      if (body?.error) {
        return String(body.error);
      }
    } catch {
      // Fall through to plain text extraction.
    }
  }

  if (errorWithContext.context?.text) {
    try {
      const body = await errorWithContext.context.text();
      if (body) {
        return body;
      }
    } catch {
      // Fall through to the original message below.
    }
  }

  return message;
}

/**
 * Create a Stripe Connect Express account for a host.
 * Calls a Supabase Edge Function that handles Stripe API calls server-side.
 */
export async function createConnectAccount(hostUserId: string): Promise<StripeOnboardingResult> {
  const { data: { session } } = await supabase.auth.getSession();
  const { data, error } = await supabase.functions.invoke("stripe-connect-onboard", {
    body: { hostUserId },
    headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : undefined,
  });
  if (data?.stripeNotConfigured) throw new StripeNotConfiguredError();
  if (error) {
    throw new Error(await extractFunctionErrorMessage(error, "Failed to create Stripe account"));
  }
  return data as StripeOnboardingResult;
}

/**
 * Create a payment intent for a booking.
 * The platform takes 20% fee, 80% goes to host.
 */
export async function createPaymentIntent(input: {
  bookingId: string;
  amount: number; // in cents
  hostStripeAccountId: string;
}): Promise<PaymentIntentResult> {
  const { data, error } = await supabase.functions.invoke("stripe-create-payment", {
    body: {
      bookingId: input.bookingId,
      amount: input.amount,
      hostStripeAccountId: input.hostStripeAccountId,
      platformFeePercent: AppConfig.PLATFORM_FEE_PERCENT,
      hostFeePercent: AppConfig.HOST_FEE_PERCENT,
    },
  });
  if (data?.stripeNotConfigured) throw new StripeNotConfiguredError();
  if (error) {
    const message = await extractFunctionErrorMessage(error, "Failed to create payment intent");
    console.error("[stripeService] createPaymentIntent error:", message);
    throw new Error(message || "Failed to create payment intent");
  }
  if (!data?.clientSecret || !data?.paymentIntentId) {
    throw new Error("Payment setup did not complete. Please try again.");
  }
  return data as PaymentIntentResult;
}

/**
 * Capture a previously authorized PaymentIntent (host approves booking).
 */
export async function capturePayment(paymentIntentId: string): Promise<void> {
  const { error } = await supabase.functions.invoke("stripe-capture-payment", {
    body: { paymentIntentId },
  });
  if (error) throw new Error(error.message || "Failed to capture payment");
}

/**
 * Cancel a PaymentIntent (host declines or booking expires — releases the hold).
 */
export async function cancelPayment(paymentIntentId: string): Promise<void> {
  const { error } = await supabase.functions.invoke("stripe-cancel-payment", {
    body: { paymentIntentId },
  });
  if (error) throw new Error(error.message || "Failed to cancel payment");
}

/**
 * Process a refund for a cancelled booking.
 * Enforces 2-hour free cancellation window server-side.
 */
export async function processRefund(bookingId: string): Promise<{
  refunded: boolean;
  fullRefund?: boolean;
}> {
  const { data, error } = await supabase.functions.invoke("process-refund", {
    body: { bookingId },
  });
  if (error) throw new Error(error.message || "Failed to process refund");
  return data as { refunded: boolean; fullRefund?: boolean };
}

/**
 * Reconcile and capture payment for actual kWh usage.
 * Called when a charging session ends.
 */
export async function reconcileAndCapture(
  bookingId: string,
  actualKwh: number
): Promise<{ actualTotal: number; hostPayout: number }> {
  const { data, error } = await supabase.functions.invoke("stripe-reconcile-payment", {
    body: { bookingId, actualKwh },
  });
  if (error) throw new Error(error.message || "Failed to reconcile payment");
  return data as { actualTotal: number; hostPayout: number };
}

/**
 * Create a Stripe Checkout Session (setup mode) so a driver can save a card.
 * Returns a browser URL — open with expo-web-browser. No native Stripe SDK needed.
 * Requires the stripe-setup-payment-method edge function to be deployed.
 */
export async function setupPaymentMethod(userId: string): Promise<{ sessionUrl: string }> {
  const { data: { session } } = await supabase.auth.getSession();
  const { data, error } = await supabase.functions.invoke("stripe-setup-payment-method", {
    body: { userId },
    headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : undefined,
  });
  if (data?.stripeNotConfigured) throw new StripeNotConfiguredError();
  if (error) {
    throw new Error(await extractFunctionErrorMessage(error, "Failed to create payment setup session"));
  }
  return data as { sessionUrl: string };
}

/**
 * Re-validate whether the current driver has a saved payment method after
 * returning from Stripe Checkout.
 */
export async function verifyPaymentMethodSetup(userId: string): Promise<PaymentSetupStatusResult> {
  const { data: { session } } = await supabase.auth.getSession();
  const { data, error } = await supabase.functions.invoke("payment-setup-complete", {
    body: { userId },
    headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : undefined,
  });
  if (data?.stripeNotConfigured) throw new StripeNotConfiguredError();
  if (error) {
    throw new Error(await extractFunctionErrorMessage(error, "Failed to verify payment setup"));
  }
  return data as PaymentSetupStatusResult;
}

/**
 * Check the onboarding status of a host's Stripe account.
 * Throws StripeNotConfiguredError if the edge function reports Stripe keys are missing.
 */
export async function getConnectAccountStatus(hostUserId: string): Promise<{
  connected: boolean;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  accountId: string | null;
  dashboardUrl: string | null;
}> {
  const { data, error } = await supabase.functions.invoke("stripe-account-status", {
    body: { hostUserId },
  });
  if (data?.stripeNotConfigured) throw new StripeNotConfiguredError();
  if (error) {
    throw new Error(await extractFunctionErrorMessage(error, "Failed to check Stripe status"));
  }
  return data as {
    connected: boolean;
    chargesEnabled: boolean;
    payoutsEnabled: boolean;
    accountId: string | null;
    dashboardUrl: string | null;
  };
}
