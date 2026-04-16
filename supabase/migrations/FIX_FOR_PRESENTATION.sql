-- ============================================================
-- FIX_FOR_PRESENTATION.sql
-- Run this in the Supabase SQL Editor before the demo.
-- It is safe to run multiple times (all statements are idempotent).
-- ============================================================

-- ── 1. Add stripe_customer_id column (for driver payment setup) ──────────────
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;

-- ── 2. Fix existing host profiles with wrong is_driver / is_host flags ────────
-- The migration 00010 set DEFAULT true on is_driver, so hosts created before
-- signUpWithEmail was fixed have is_driver = true and is_host = false.
-- This brings them in line with their actual role column value.

UPDATE profiles SET
  is_driver = (role IN ('driver', 'admin')),
  is_host   = (role IN ('host',   'admin')),
  is_admin  = (role = 'admin')
WHERE
  -- Only update rows where the flags don't match the role column
  is_driver != (role IN ('driver', 'admin'))
  OR is_host  != (role IN ('host',   'admin'))
  OR is_admin != (role = 'admin');

-- ── 3. Seed platform_config if it exists but is empty ─────────────────────────
INSERT INTO platform_config (key, value, description, updated_by, updated_at)
VALUES
  ('platform_fee_percent',   '10', 'Fee added to driver total',                NULL, NOW()),
  ('host_fee_percent',       '10', 'Fee deducted from host payout',            NULL, NOW()),
  ('booking_expiry_hours',   '24', 'Hours before unreplied booking expires',   NULL, NOW()),
  ('grace_period_minutes',   '15', 'Minutes after start before no-show',       NULL, NOW()),
  ('free_cancel_hours',      '2',  'Hours before start for full refund',       NULL, NOW()),
  ('charger_approved_score', '85', 'Minimum rubric score for approval',        NULL, NOW()),
  ('charger_rejected_score', '45', 'Max score before auto-rejection',          NULL, NOW())
ON CONFLICT (key) DO NOTHING;

-- ── 4. Fix verification_gates so drivers with a saved card can book ───────────
-- driver_cleared = email_verified AND phone_verified AND payment_method_added
-- Email/phone OTP is a future feature; treat authenticated users as verified.
UPDATE verification_gates SET
  email_verified = true,
  phone_verified = true
WHERE payment_method_added = true
  AND (email_verified = false OR phone_verified = false);

-- If a driver has a stripe_customer_id but no verification gate row, create one.
INSERT INTO verification_gates (user_id, email_verified, phone_verified, payment_method_added)
SELECT id, true, true, true
FROM profiles
WHERE stripe_customer_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM verification_gates WHERE verification_gates.user_id = profiles.id
  )
ON CONFLICT (user_id) DO NOTHING;

-- ── 5. Verify results ──────────────────────────────────────────────────────────
-- After running, check these queries return sensible data:
--
-- SELECT id, email, role, is_driver, is_host, is_admin FROM profiles;
-- SELECT key, value FROM platform_config;
-- SELECT column_name FROM information_schema.columns
--   WHERE table_name = 'profiles' AND column_name = 'stripe_customer_id';
