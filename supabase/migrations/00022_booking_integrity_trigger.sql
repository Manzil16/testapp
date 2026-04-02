-- Migration 00022: Booking integrity constraints
-- 1. Enforces valid status transitions (prevents impossible state jumps)
-- 2. Makes total_amount and host_id immutable after row creation

CREATE OR REPLACE FUNCTION enforce_booking_integrity()
RETURNS TRIGGER AS $$
BEGIN
  -- ── Immutability guards ────────────────────────────────────────────────
  -- total_amount is set once at booking creation; use actual_amount for reconciliation
  IF OLD.total_amount IS DISTINCT FROM NEW.total_amount THEN
    RAISE EXCEPTION
      'total_amount is immutable after booking creation (booking %). '
      'Use actual_amount for session reconciliation.',
      NEW.id
      USING ERRCODE = 'integrity_constraint_violation';
  END IF;

  -- host_id must never change — it determines who receives payout
  IF OLD.host_id IS DISTINCT FROM NEW.host_id THEN
    RAISE EXCEPTION
      'host_id is immutable after booking creation (booking %)',
      NEW.id
      USING ERRCODE = 'integrity_constraint_violation';
  END IF;

  -- ── Status transition guard ────────────────────────────────────────────
  IF OLD.status IS NOT DISTINCT FROM NEW.status THEN
    RETURN NEW;  -- no status change, nothing to validate
  END IF;

  -- Valid transitions only:
  --   requested → approved | declined | expired | cancelled
  --   approved  → active   | missed   | cancelled
  --   active    → completed | cancelled
  --   completed / missed / expired / declined / cancelled  → terminal (no exit)
  IF NOT (
    (OLD.status = 'requested' AND NEW.status IN ('approved', 'declined', 'expired', 'cancelled'))
    OR (OLD.status = 'approved'  AND NEW.status IN ('active',   'missed',   'cancelled'))
    OR (OLD.status = 'active'    AND NEW.status IN ('completed','cancelled'))
  ) THEN
    RAISE EXCEPTION
      'Invalid booking status transition: % → % (booking %)',
      OLD.status, NEW.status, NEW.id
      USING ERRCODE = 'integrity_constraint_violation';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS booking_integrity_check ON bookings;
CREATE TRIGGER booking_integrity_check
BEFORE UPDATE ON bookings
FOR EACH ROW
EXECUTE FUNCTION enforce_booking_integrity();
