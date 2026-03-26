-- =====================================================================
-- VehicleGrid Combined Migrations 00015–00019
-- Run this in the Supabase SQL Editor to apply all new migrations safely.
-- All statements use IF NOT EXISTS / IF EXISTS guards for idempotency.
-- =====================================================================

-- ─── 00015: Booking Session Fields ──────────────────────────────────

ALTER TABLE bookings ADD COLUMN IF NOT EXISTS grace_expires_at TIMESTAMPTZ;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS actual_kwh NUMERIC(8,3);
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS actual_amount NUMERIC(10,2);
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS session_started_at TIMESTAMPTZ;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS session_ended_at TIMESTAMPTZ;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS cancellation_reason TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS host_payout_amount NUMERIC(10,2);

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS expo_push_token TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS avg_response_minutes INTEGER;

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

-- ─── 00016: Verification Gates ──────────────────────────────────────

CREATE TABLE IF NOT EXISTS verification_gates (
  user_id                UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  email_verified         BOOLEAN DEFAULT FALSE,
  phone_verified         BOOLEAN DEFAULT FALSE,
  payment_method_added   BOOLEAN DEFAULT FALSE,
  id_verified            BOOLEAN DEFAULT FALSE,
  id_document_url        TEXT,
  stripe_onboarded       BOOLEAN DEFAULT FALSE,
  stripe_identity_session_id TEXT,
  driver_cleared BOOLEAN GENERATED ALWAYS AS (
    email_verified AND phone_verified AND payment_method_added
  ) STORED,
  host_cleared BOOLEAN GENERATED ALWAYS AS (
    email_verified AND phone_verified AND id_verified AND stripe_onboarded
  ) STORED,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE verification_gates ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Users can view own verification gate"
    ON verification_gates FOR SELECT USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Users can update own verification gate"
    ON verification_gates FOR UPDATE USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Users can insert own verification gate"
    ON verification_gates FOR INSERT WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Admins can view all verification gates"
    ON verification_gates FOR SELECT
    USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "vg_service_role"
    ON verification_gates FOR ALL USING (auth.role() = 'service_role');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ─── 00017: Admin Audit Log ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS admin_audit_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id    UUID REFERENCES profiles(id) ON DELETE SET NULL,
  action      TEXT NOT NULL,
  target_type TEXT,
  target_id   UUID,
  details     JSONB DEFAULT '{}',
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS aal_admin_idx ON admin_audit_log(admin_id);
CREATE INDEX IF NOT EXISTS aal_target_idx ON admin_audit_log(target_type, target_id);
CREATE INDEX IF NOT EXISTS aal_created_idx ON admin_audit_log(created_at DESC);

ALTER TABLE admin_audit_log ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Admins can view audit log"
    ON admin_audit_log FOR SELECT
    USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Admins can insert audit log"
    ON admin_audit_log FOR INSERT
    WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "aal_service_role"
    ON admin_audit_log FOR ALL USING (auth.role() = 'service_role');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ─── 00018: Platform Events ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS platform_events (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type    TEXT NOT NULL,
  actor_user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  actor_role    TEXT,
  target_type   TEXT,
  target_id     UUID,
  amount_cents  INTEGER,
  kwh           NUMERIC(8,3),
  duration_min  INTEGER,
  image_url     TEXT,
  metadata      JSONB DEFAULT '{}',
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS pe_event_type_idx ON platform_events(event_type);
CREATE INDEX IF NOT EXISTS pe_actor_idx      ON platform_events(actor_user_id);
CREATE INDEX IF NOT EXISTS pe_target_idx     ON platform_events(target_type, target_id);
CREATE INDEX IF NOT EXISTS pe_created_at_idx ON platform_events(created_at DESC);
CREATE INDEX IF NOT EXISTS pe_amount_idx     ON platform_events(amount_cents) WHERE amount_cents IS NOT NULL;
CREATE INDEX IF NOT EXISTS pe_metadata_gin   ON platform_events USING GIN(metadata);

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

ALTER TABLE platform_events ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Admins can view platform events"
    ON platform_events FOR SELECT
    USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "pe_service_role"
    ON platform_events FOR ALL USING (auth.role() = 'service_role');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Booking status change trigger
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

-- ─── 00019: Platform Config ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS platform_config (
  key         TEXT PRIMARY KEY,
  value       TEXT NOT NULL,
  description TEXT,
  updated_by  UUID REFERENCES profiles(id),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO platform_config (key, value, description, updated_by, updated_at) VALUES
  ('platform_fee_percent',    '10',  'Fee added to driver total',                NULL, NOW()),
  ('host_fee_percent',        '10',  'Fee deducted from host payout',            NULL, NOW()),
  ('booking_expiry_hours',    '24',  'Hours before unreplied booking expires',   NULL, NOW()),
  ('grace_period_minutes',    '15',  'Minutes after start before no-show',       NULL, NOW()),
  ('free_cancel_hours',       '2',   'Hours before start for full refund',       NULL, NOW()),
  ('charger_approved_score',  '85',  'Minimum rubric score for approval',        NULL, NOW()),
  ('charger_rejected_score',  '45',  'Max score before auto-rejection',          NULL, NOW())
ON CONFLICT (key) DO NOTHING;

ALTER TABLE platform_config ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Anyone can read platform config"
    ON platform_config FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Admins can update platform config"
    ON platform_config FOR UPDATE
    USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "pc_service_role"
    ON platform_config FOR ALL USING (auth.role() = 'service_role');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- =====================================================================
-- Done. All 5 migrations (00015–00019) applied.
-- =====================================================================
