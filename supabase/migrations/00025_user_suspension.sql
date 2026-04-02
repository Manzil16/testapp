-- Migration 00025: User suspension flag
-- Adds is_suspended column to profiles.
-- Adds RLS policies that block suspended users from creating bookings or chargers.

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS is_suspended BOOLEAN NOT NULL DEFAULT FALSE;

-- ─── RLS policies ─────────────────────────────────────────────────────────
-- These are INSERT-level guards. The existing SELECT/UPDATE RLS on each table
-- is unchanged; only new row creation is blocked for suspended accounts.

-- Block suspended drivers from creating bookings
DROP POLICY IF EXISTS "block_suspended_users_insert_bookings" ON bookings;
CREATE POLICY "block_suspended_users_insert_bookings"
  ON bookings
  FOR INSERT
  TO authenticated
  WITH CHECK (
    NOT EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.is_suspended = true
    )
  );

-- Block suspended hosts from submitting chargers
DROP POLICY IF EXISTS "block_suspended_users_insert_chargers" ON chargers;
CREATE POLICY "block_suspended_users_insert_chargers"
  ON chargers
  FOR INSERT
  TO authenticated
  WITH CHECK (
    NOT EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.is_suspended = true
    )
  );
