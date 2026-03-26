-- ============================================================
-- Migration 00007: Add payment_status column to bookings
-- Issue #4/#5: Track Stripe payment lifecycle separately from booking status
-- ============================================================

ALTER TABLE public.bookings
  ADD COLUMN payment_status TEXT NOT NULL DEFAULT 'pending'
  CHECK (payment_status IN ('pending', 'authorized', 'captured', 'failed', 'refunded', 'cancelled'));
