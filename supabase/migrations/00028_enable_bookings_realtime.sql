-- Migration 00028: Enable Realtime on bookings
-- Required by useHostBookings hook so hosts see new/updated bookings without refresh.
-- Idempotent: the DO block swallows the duplicate-table error if already a member.

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.bookings;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
