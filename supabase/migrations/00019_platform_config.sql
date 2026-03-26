-- Migration 00019: Platform config table
-- Dynamic platform configuration (replaces hardcoded AppConfig for server-side values)

CREATE TABLE IF NOT EXISTS platform_config (
  key         TEXT PRIMARY KEY,
  value       TEXT NOT NULL,
  description TEXT,
  updated_by  UUID REFERENCES profiles(id),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Seed default values
INSERT INTO platform_config (key, value, description, updated_by, updated_at) VALUES
  ('platform_fee_percent',    '10',  'Fee added to driver total',                NULL, NOW()),
  ('host_fee_percent',        '10',  'Fee deducted from host payout',            NULL, NOW()),
  ('booking_expiry_hours',    '24',  'Hours before unreplied booking expires',   NULL, NOW()),
  ('grace_period_minutes',    '15',  'Minutes after start before no-show',       NULL, NOW()),
  ('free_cancel_hours',       '2',   'Hours before start for full refund',       NULL, NOW()),
  ('charger_approved_score',  '85',  'Minimum rubric score for approval',        NULL, NOW()),
  ('charger_rejected_score',  '45',  'Max score before auto-rejection',          NULL, NOW())
ON CONFLICT (key) DO NOTHING;

-- RLS: anyone can read, only admins can update
ALTER TABLE platform_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read platform config"
  ON platform_config FOR SELECT
  USING (true);

CREATE POLICY "Admins can update platform config"
  ON platform_config FOR UPDATE
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true));

CREATE POLICY "Service role full access"
  ON platform_config FOR ALL
  USING (auth.role() = 'service_role');
