import { supabase } from "../lib/supabase";

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
      platformFeePercent: 20,
    },
  });
  if (error) throw new Error(error.message || "Failed to create payment intent");
  return data as PaymentIntentResult;
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
