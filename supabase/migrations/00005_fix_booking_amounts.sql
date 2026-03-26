-- ============================================================
-- Migration 00005: Fix booking amount columns
-- Issue #3: total_amount stored pre-fee subtotal, UI showed fee-inclusive total
-- Now: subtotal_amount = base price, total_amount = what driver pays (includes fee)
-- ============================================================

-- Add subtotal_amount column
ALTER TABLE public.bookings
  ADD COLUMN subtotal_amount NUMERIC(10,2) NOT NULL DEFAULT 0;

-- Migrate existing data: current total_amount IS the subtotal (pre-fee)
UPDATE public.bookings
  SET subtotal_amount = total_amount;

-- Now update total_amount to be the fee-inclusive driver total
UPDATE public.bookings
  SET total_amount = subtotal_amount + platform_fee;
