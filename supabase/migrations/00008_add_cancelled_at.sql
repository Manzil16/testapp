-- ============================================================
-- Migration 00008: Add cancelled_at to bookings
-- Issue #6: Track when cancellations/refunds happen
-- ============================================================

ALTER TABLE public.bookings
  ADD COLUMN cancelled_at TIMESTAMPTZ;
