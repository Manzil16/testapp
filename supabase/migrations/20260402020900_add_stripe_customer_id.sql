-- Migration: add stripe_customer_id to profiles
-- Used by the stripe-setup-payment-method edge function to link drivers
-- to their Stripe Customer object so cards can be saved off-session.

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;
