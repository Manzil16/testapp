-- Migration 00021: Host Response Time Tracking
-- Tracks how long hosts take to respond to booking requests (approve/decline).
-- Updates profiles.avg_response_minutes with a rolling average.

-- 1. Create a trigger function that calculates response time when a booking
--    transitions from 'requested' to 'approved' or 'declined'.
CREATE OR REPLACE FUNCTION track_host_response_time()
RETURNS TRIGGER AS $$
DECLARE
  v_response_minutes NUMERIC;
  v_current_avg NUMERIC;
  v_response_count INT;
BEGIN
  -- Only fire when status changes from 'requested' to 'approved' or 'declined'
  IF OLD.status = 'requested' AND NEW.status IN ('approved', 'declined') THEN
    -- Calculate response time in minutes
    v_response_minutes := EXTRACT(EPOCH FROM (NOW() - OLD.created_at)) / 60.0;

    -- Get current average and approximate count from profile
    SELECT avg_response_minutes INTO v_current_avg
    FROM profiles
    WHERE id = NEW.host_id;

    -- If no previous average, use this response time directly
    IF v_current_avg IS NULL OR v_current_avg = 0 THEN
      UPDATE profiles
      SET avg_response_minutes = ROUND(v_response_minutes::NUMERIC, 1)
      WHERE id = NEW.host_id;
    ELSE
      -- Exponential moving average (weight recent responses more)
      -- EMA = alpha * new_value + (1 - alpha) * old_average
      -- alpha = 0.3 gives ~70% weight to history, 30% to new data point
      UPDATE profiles
      SET avg_response_minutes = ROUND(
        (0.3 * v_response_minutes + 0.7 * v_current_avg)::NUMERIC,
        1
      )
      WHERE id = NEW.host_id;
    END IF;

    -- Log the response event
    INSERT INTO platform_events (
      event_type, actor_id, actor_role, target_type, target_id, metadata
    ) VALUES (
      'booking.host_responded',
      NEW.host_id,
      'host',
      'booking',
      NEW.id,
      jsonb_build_object(
        'response_minutes', ROUND(v_response_minutes::NUMERIC, 1),
        'new_status', NEW.status,
        'booking_id', NEW.id,
        'driver_id', NEW.driver_id,
        'charger_id', NEW.charger_id
      )
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Attach trigger to bookings table
DROP TRIGGER IF EXISTS trg_track_host_response ON bookings;
CREATE TRIGGER trg_track_host_response
  AFTER UPDATE ON bookings
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION track_host_response_time();
