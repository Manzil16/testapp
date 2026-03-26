-- Migration 00015: Booking session fields
-- Adds columns for grace period, actual usage, session timestamps, cancellation, and host payout

ALTER TABLE bookings ADD COLUMN IF NOT EXISTS grace_expires_at TIMESTAMPTZ;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS actual_kwh NUMERIC(8,3);
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS actual_amount NUMERIC(10,2);
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS session_started_at TIMESTAMPTZ;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS session_ended_at TIMESTAMPTZ;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS cancellation_reason TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS host_payout_amount NUMERIC(10,2);

-- Add expo_push_token and avg_response_minutes to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS expo_push_token TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS avg_response_minutes INTEGER;

-- Grace period trigger: when approved, set grace window = start_time + 15 min
CREATE OR REPLACE FUNCTION set_grace_period()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'approved' AND OLD.status = 'requested' THEN
    NEW.grace_expires_at := NEW.start_time + INTERVAL '15 minutes';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS booking_grace_period ON bookings;
CREATE TRIGGER booking_grace_period
BEFORE UPDATE ON bookings
FOR EACH ROW EXECUTE FUNCTION set_grace_period();

-- pg_cron job: mark missed bookings every 5 minutes
-- Note: pg_cron must be enabled in Supabase dashboard first
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.schedule('mark-missed-bookings', '*/5 * * * *', $$
      UPDATE bookings
      SET status = 'missed'
      WHERE status = 'approved'
        AND grace_expires_at < NOW()
        AND arrival_signal NOT IN ('arrived', 'charging');
    $$);
  END IF;
END $$;
