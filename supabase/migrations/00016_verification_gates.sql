-- Migration 00016: Verification gates table
-- Digital verification system for drivers and hosts

CREATE TABLE IF NOT EXISTS verification_gates (
  user_id                UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  email_verified         BOOLEAN DEFAULT FALSE,
  phone_verified         BOOLEAN DEFAULT FALSE,
  payment_method_added   BOOLEAN DEFAULT FALSE,
  id_verified            BOOLEAN DEFAULT FALSE,
  id_document_url        TEXT,
  stripe_onboarded       BOOLEAN DEFAULT FALSE,
  stripe_identity_session_id TEXT,
  -- Computed clearance flags
  driver_cleared BOOLEAN GENERATED ALWAYS AS (
    email_verified AND phone_verified AND payment_method_added
  ) STORED,
  host_cleared BOOLEAN GENERATED ALWAYS AS (
    email_verified AND phone_verified AND id_verified AND stripe_onboarded
  ) STORED,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS policies for verification_gates
ALTER TABLE verification_gates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own verification gate"
  ON verification_gates FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own verification gate"
  ON verification_gates FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own verification gate"
  ON verification_gates FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all verification gates"
  ON verification_gates FOR SELECT
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true));

CREATE POLICY "Service role full access"
  ON verification_gates FOR ALL
  USING (auth.role() = 'service_role');
