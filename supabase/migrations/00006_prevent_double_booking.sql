-- ============================================================
-- Migration 00006: Prevent double-booking on the same charger
-- Issue #12: No overlap prevention — two drivers could book same slot
-- Uses btree_gist EXCLUDE constraint on (charger_id, time_range)
-- ============================================================

-- Required for EXCLUDE USING GIST with non-geometric types
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- Add a tstzrange column derived from start_time/end_time
ALTER TABLE public.bookings
  ADD COLUMN time_range tstzrange
  GENERATED ALWAYS AS (tstzrange(start_time, end_time, '[)')) STORED;

-- Prevent overlapping bookings on the same charger (excluding cancelled/declined/expired)
ALTER TABLE public.bookings
  ADD CONSTRAINT no_double_booking
  EXCLUDE USING GIST (
    charger_id WITH =,
    time_range WITH &&
  ) WHERE (status NOT IN ('cancelled', 'declined'));

-- Index for efficient overlap checks
CREATE INDEX idx_bookings_time_range ON public.bookings USING GIST (time_range);
