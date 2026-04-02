-- Migration 00023: Platform events RLS + integrity trigger amendment
-- 1. Amends booking integrity trigger to allow → flagged_for_review
-- 2. Enables RLS on platform_events with correct access policies

-- ─── 1. Amend integrity trigger ────────────────────────────────────────────
-- Adds flagged_for_review as a valid target from approved, active, or completed
-- (needed by the webhook amount-mismatch handler).

CREATE OR REPLACE FUNCTION enforce_booking_integrity()
RETURNS TRIGGER AS $$
BEGIN
  -- ── Immutability guards ────────────────────────────────────────────────
  IF OLD.total_amount IS DISTINCT FROM NEW.total_amount THEN
    RAISE EXCEPTION
      'total_amount is immutable after booking creation (booking %). '
      'Use actual_amount for session reconciliation.',
      NEW.id
      USING ERRCODE = 'integrity_constraint_violation';
  END IF;

  IF OLD.host_id IS DISTINCT FROM NEW.host_id THEN
    RAISE EXCEPTION
      'host_id is immutable after booking creation (booking %)',
      NEW.id
      USING ERRCODE = 'integrity_constraint_violation';
  END IF;

  -- ── Status transition guard ────────────────────────────────────────────
  IF OLD.status IS NOT DISTINCT FROM NEW.status THEN
    RETURN NEW;
  END IF;

  -- Valid transitions:
  --   requested → approved | declined | expired | cancelled
  --   approved  → active   | missed   | cancelled | flagged_for_review
  --   active    → completed | cancelled | flagged_for_review
  --   completed → flagged_for_review  (post-capture amount mismatch from webhook)
  IF NOT (
    (OLD.status = 'requested'  AND NEW.status IN ('approved', 'declined', 'expired', 'cancelled'))
    OR (OLD.status = 'approved'   AND NEW.status IN ('active', 'missed', 'cancelled', 'flagged_for_review'))
    OR (OLD.status = 'active'     AND NEW.status IN ('completed', 'cancelled', 'flagged_for_review'))
    OR (OLD.status = 'completed'  AND NEW.status = 'flagged_for_review')
  ) THEN
    RAISE EXCEPTION
      'Invalid booking status transition: % → % (booking %)',
      OLD.status, NEW.status, NEW.id
      USING ERRCODE = 'integrity_constraint_violation';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ─── 2. Platform events RLS ────────────────────────────────────────────────

ALTER TABLE platform_events ENABLE ROW LEVEL SECURITY;

-- Service role: full insert access (edge functions, webhook, DB triggers)
DROP POLICY IF EXISTS "service_role_insert_platform_events" ON platform_events;
CREATE POLICY "service_role_insert_platform_events"
  ON platform_events
  FOR INSERT
  TO service_role
  WITH CHECK (true);

-- Authenticated users: read only their own events
DROP POLICY IF EXISTS "users_select_own_events" ON platform_events;
CREATE POLICY "users_select_own_events"
  ON platform_events
  FOR SELECT
  TO authenticated
  USING (actor_user_id = auth.uid());

-- Admins: read all events (used by admin-overview.tsx)
DROP POLICY IF EXISTS "admins_select_all_events" ON platform_events;
CREATE POLICY "admins_select_all_events"
  ON platform_events
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.is_admin = true
    )
  );
