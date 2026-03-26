-- Migration 00017: Admin audit log
-- Tracks all admin actions for accountability

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

-- RLS: only admins can read/write
ALTER TABLE admin_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view audit log"
  ON admin_audit_log FOR SELECT
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true));

CREATE POLICY "Admins can insert audit log"
  ON admin_audit_log FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true));

CREATE POLICY "Service role full access"
  ON admin_audit_log FOR ALL
  USING (auth.role() = 'service_role');
