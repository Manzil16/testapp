import { supabase } from "../lib/supabase";
import { AppConfig } from "../constants/app";

export interface StripeOnboardingResult {
  accountId: string;
  onboardingUrl: string;
}

export interface PaymentIntentResult {
  clientSecret: string;
  paymentIntentId: string;
}

/**
 * Create a Stripe Connect Express account for a host.
 * Calls a Supabase Edge Function that handles Stripe API calls server-side.
 */
export async function createConnectAccount(hostUserId: string): Promise<StripeOnboardingResult> {
  const { data, error } = await supabase.functions.invoke("stripe-connect-onboard", {
    body: { hostUserId },
  });
  if (error) throw new Error(error.message || "Failed to create Stripe account");
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
  if (error) {
    console.error("[stripeService] createPaymentIntent error:", JSON.stringify(error));
    console.error("[stripeService] response data:", JSON.stringify(data));
    throw new Error(error.message || "Failed to create payment intent");
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
 * Check the onboarding status of a host's Stripe account.
 */
export async function getConnectAccountStatus(hostUserId: string): Promise<{
  isOnboarded: boolean;
  accountId: string | null;
  dashboardUrl: string | null;
}> {
  const { data, error } = await supabase.functions.invoke("stripe-account-status", {
    body: { hostUserId },
  });
  if (error) throw new Error(error.message || "Failed to check Stripe status");
  return data as { isOnboarded: boolean; accountId: string | null; dashboardUrl: string | null };
}
