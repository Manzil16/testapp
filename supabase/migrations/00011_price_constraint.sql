-- ============================================================
-- Migration 00011: Add DB-level price constraint on chargers
-- Issue #19: No CHECK — $0 or $99/kWh possible via direct API or bugs
-- ============================================================

ALTER TABLE public.chargers
  ADD CONSTRAINT reasonable_price CHECK (
    price_per_kwh >= 0.20 AND price_per_kwh <= 2.50
  );
