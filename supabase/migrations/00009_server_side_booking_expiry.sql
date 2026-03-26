-- ============================================================
-- Migration 00009: Server-side booking expiry via pg_cron
-- Issue #9: Expired bookings were only visually cancelled on driver's device
-- Host could still see/approve expired bookings
-- ============================================================

-- Enable pg_cron (must be enabled in Supabase dashboard first)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule job: every 5 minutes, expire stale bookings
SELECT cron.schedule(
  'expire-stale-bookings',
  '*/5 * * * *',
  $$
    UPDATE public.bookings
    SET status = 'cancelled',
        payment_status = CASE
          WHEN stripe_payment_intent_id IS NOT NULL THEN 'cancelled'
          ELSE payment_status
        END,
        note = 'Expired — host did not respond in time'
    WHERE status = 'requested'
      AND expires_at IS NOT NULL
      AND expires_at < NOW();
  $$
);

-- Prevent host from approving an already-expired booking
CREATE OR REPLACE FUNCTION public.prevent_approve_expired()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'approved' AND OLD.expires_at IS NOT NULL AND OLD.expires_at < NOW() AND OLD.status = 'requested' THEN
    RAISE EXCEPTION 'Cannot approve an expired booking';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER check_booking_not_expired
  BEFORE UPDATE ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_approve_expired();
