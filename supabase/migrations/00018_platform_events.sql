-- Migration 00018: Platform events table
-- Unified event log for all platform activity

CREATE TABLE IF NOT EXISTS platform_events (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type    TEXT NOT NULL,
  -- Event type taxonomy:
  -- booking.requested, booking.approved, booking.declined, booking.cancelled,
  -- booking.missed, booking.expired, booking.completed
  -- payment.authorized, payment.captured, payment.refunded, payment.cancelled
  -- session.started, session.ended
  -- charger.submitted, charger.approved, charger.rejected
  -- user.signed_up, user.verified_phone, user.verified_id, user.stripe_onboarded
  -- user.suspended, user.restored
  -- image.uploaded, image.flagged
  -- review.submitted, review.deleted
  -- admin.action (for all admin-initiated events)

  actor_user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  actor_role    TEXT,  -- 'driver' | 'host' | 'admin' | 'system'

  target_type   TEXT,  -- 'booking' | 'charger' | 'user' | 'payment' | 'image' | 'review'
  target_id     UUID,

  -- Denormalised metric snapshot (for fast admin queries without joins)
  amount_cents  INTEGER,
  kwh           NUMERIC(8,3),
  duration_min  INTEGER,
  image_url     TEXT,

  -- Full context for detail view
  metadata      JSONB DEFAULT '{}',

  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS pe_event_type_idx ON platform_events(event_type);
CREATE INDEX IF NOT EXISTS pe_actor_idx      ON platform_events(actor_user_id);
CREATE INDEX IF NOT EXISTS pe_target_idx     ON platform_events(target_type, target_id);
CREATE INDEX IF NOT EXISTS pe_created_at_idx ON platform_events(created_at DESC);
CREATE INDEX IF NOT EXISTS pe_amount_idx     ON platform_events(amount_cents) WHERE amount_cents IS NOT NULL;
CREATE INDEX IF NOT EXISTS pe_metadata_gin   ON platform_events USING GIN(metadata);

-- Full-text search index across names and event type
ALTER TABLE platform_events ADD COLUMN IF NOT EXISTS fts_vector TSVECTOR
  GENERATED ALWAYS AS (
    to_tsvector('english',
      COALESCE(metadata->>'driver_name','') || ' ' ||
      COALESCE(metadata->>'host_name','') || ' ' ||
      COALESCE(metadata->>'charger_name','') || ' ' ||
      COALESCE(event_type,'') || ' ' ||
      COALESCE(metadata->>'email','') || ' ' ||
      COALESCE(target_id::text,'')
    )
  ) STORED;

CREATE INDEX IF NOT EXISTS pe_fts ON platform_events USING GIN(fts_vector);

-- RLS: only admins can read platform events
ALTER TABLE platform_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view platform events"
  ON platform_events FOR SELECT
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true));

CREATE POLICY "Service role full access"
  ON platform_events FOR ALL
  USING (auth.role() = 'service_role');

-- Trigger to auto-write booking status change events
CREATE OR REPLACE FUNCTION log_booking_event()
RETURNS TRIGGER AS $$
DECLARE
  v_driver_name  TEXT;
  v_host_name    TEXT;
  v_charger_name TEXT;
  v_charger_addr TEXT;
BEGIN
  SELECT display_name INTO v_driver_name  FROM profiles WHERE id = NEW.driver_id;
  SELECT display_name INTO v_host_name    FROM profiles WHERE id = NEW.host_id;
  SELECT name, address INTO v_charger_name, v_charger_addr FROM chargers WHERE id = NEW.charger_id;

  INSERT INTO platform_events (
    event_type, actor_role, target_type, target_id,
    amount_cents, kwh, duration_min, metadata
  ) VALUES (
    'booking.' || NEW.status,
    CASE
      WHEN NEW.status IN ('requested','cancelled') THEN 'driver'
      WHEN NEW.status IN ('approved','declined')   THEN 'host'
      ELSE 'system'
    END,
    'booking',
    NEW.id,
    ROUND(COALESCE(NEW.actual_amount, NEW.total_amount, 0) * 100)::INTEGER,
    COALESCE(NEW.actual_kwh, NEW.estimated_kwh),
    EXTRACT(EPOCH FROM (NEW.end_time - NEW.start_time))::INTEGER / 60,
    jsonb_build_object(
      'booking_id',            NEW.id,
      'driver_id',             NEW.driver_id,
      'driver_name',           v_driver_name,
      'host_id',               NEW.host_id,
      'host_name',             v_host_name,
      'charger_id',            NEW.charger_id,
      'charger_name',          v_charger_name,
      'charger_address',       v_charger_addr,
      'status_from',           OLD.status,
      'status_to',             NEW.status,
      'start_time',            NEW.start_time,
      'end_time',              NEW.end_time,
      'estimated_kwh',         NEW.estimated_kwh,
      'actual_kwh',            NEW.actual_kwh,
      'stripe_payment_intent', NEW.stripe_payment_intent_id,
      'cancellation_reason',   NEW.cancellation_reason,
      'host_payout',           NEW.host_payout_amount
    )
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS booking_event_logger ON bookings;
CREATE TRIGGER booking_event_logger
AFTER UPDATE OF status ON bookings
FOR EACH ROW
WHEN (OLD.status IS DISTINCT FROM NEW.status)
EXECUTE FUNCTION log_booking_event();
