-- Migration 00020: Complete event trigger coverage
-- Adds triggers for charger, user verification, and review events

-- ─── 1. Charger status change trigger ────────────────────────────────

CREATE OR REPLACE FUNCTION log_charger_event()
RETURNS TRIGGER AS $$
DECLARE
  v_host_name TEXT;
BEGIN
  -- Only fire when status actually changes
  IF OLD.status IS NOT DISTINCT FROM NEW.status THEN
    RETURN NEW;
  END IF;

  SELECT display_name INTO v_host_name FROM profiles WHERE id = NEW.host_id;

  INSERT INTO platform_events (
    event_type, actor_user_id, actor_role, target_type, target_id,
    image_url, metadata
  ) VALUES (
    CASE
      WHEN NEW.status = 'pending'  THEN 'charger.submitted'
      WHEN NEW.status = 'approved' THEN 'charger.approved'
      WHEN NEW.status = 'rejected' THEN 'charger.rejected'
      ELSE 'charger.' || NEW.status
    END,
    CASE
      WHEN NEW.status = 'pending' THEN NEW.host_id
      ELSE NULL  -- admin actions set actor via application layer
    END,
    CASE
      WHEN NEW.status = 'pending' THEN 'host'
      ELSE 'admin'
    END,
    'charger',
    NEW.id,
    CASE WHEN array_length(NEW.images, 1) > 0 THEN NEW.images[1] ELSE NULL END,
    jsonb_build_object(
      'charger_id',          NEW.id,
      'charger_name',        NEW.name,
      'host_id',             NEW.host_id,
      'host_name',           v_host_name,
      'address',             NEW.address,
      'suburb',              COALESCE(NEW.suburb, ''),
      'max_power_kw',        NEW.max_power_kw,
      'connector_types',     NEW.connectors,
      'price_per_kwh',       NEW.price_per_kwh,
      'image_urls',          NEW.images,
      'verification_score',  NEW.verification_score,
      'rubric',              jsonb_build_object(
        'photos',   COALESCE(NEW.rubric_photo_quality, 0),
        'specs',    COALESCE(NEW.rubric_plug_verified, 0),
        'location', COALESCE(NEW.rubric_location_accuracy, 0),
        'access',   COALESCE(NEW.rubric_host_response, 0),
        'pricing',  COALESCE(NEW.rubric_admin_review, 0)
      ),
      'rejection_reason',    CASE WHEN NEW.status = 'rejected' THEN COALESCE(NEW.availability_note, '') ELSE NULL END,
      'reviewed_by_admin_id', NULL
    )
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS charger_event_logger ON chargers;
CREATE TRIGGER charger_event_logger
AFTER UPDATE OF status ON chargers
FOR EACH ROW
WHEN (OLD.status IS DISTINCT FROM NEW.status)
EXECUTE FUNCTION log_charger_event();

-- Also trigger on INSERT for new charger submissions
CREATE OR REPLACE FUNCTION log_charger_insert_event()
RETURNS TRIGGER AS $$
DECLARE
  v_host_name TEXT;
BEGIN
  IF NEW.status != 'pending' THEN
    RETURN NEW;
  END IF;

  SELECT display_name INTO v_host_name FROM profiles WHERE id = NEW.host_id;

  INSERT INTO platform_events (
    event_type, actor_user_id, actor_role, target_type, target_id,
    image_url, metadata
  ) VALUES (
    'charger.submitted',
    NEW.host_id,
    'host',
    'charger',
    NEW.id,
    CASE WHEN array_length(NEW.images, 1) > 0 THEN NEW.images[1] ELSE NULL END,
    jsonb_build_object(
      'charger_id',     NEW.id,
      'charger_name',   NEW.name,
      'host_id',        NEW.host_id,
      'host_name',      v_host_name,
      'address',        NEW.address,
      'suburb',         COALESCE(NEW.suburb, ''),
      'max_power_kw',   NEW.max_power_kw,
      'connector_types', NEW.connectors,
      'price_per_kwh',  NEW.price_per_kwh,
      'image_urls',     NEW.images
    )
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS charger_insert_event_logger ON chargers;
CREATE TRIGGER charger_insert_event_logger
AFTER INSERT ON chargers
FOR EACH ROW
EXECUTE FUNCTION log_charger_insert_event();

-- ─── 2. User verification change trigger ─────────────────────────────

CREATE OR REPLACE FUNCTION log_verification_event()
RETURNS TRIGGER AS $$
DECLARE
  v_user_name  TEXT;
  v_user_email TEXT;
  v_user_role  TEXT;
  v_event_type TEXT;
BEGIN
  SELECT display_name, email, role
  INTO v_user_name, v_user_email, v_user_role
  FROM profiles WHERE id = NEW.user_id;

  -- Determine which verification changed
  IF NEW.phone_verified AND NOT OLD.phone_verified THEN
    v_event_type := 'user.verified_phone';
  ELSIF NEW.id_verified AND NOT OLD.id_verified THEN
    v_event_type := 'user.verified_id';
  ELSIF NEW.stripe_onboarded AND NOT OLD.stripe_onboarded THEN
    v_event_type := 'user.stripe_onboarded';
  ELSIF NEW.payment_method_added AND NOT OLD.payment_method_added THEN
    v_event_type := 'user.payment_method_added';
  ELSE
    -- No relevant change
    RETURN NEW;
  END IF;

  INSERT INTO platform_events (
    event_type, actor_user_id, actor_role, target_type, target_id,
    metadata
  ) VALUES (
    v_event_type,
    NEW.user_id,
    v_user_role,
    'user',
    NEW.user_id,
    jsonb_build_object(
      'user_id',          NEW.user_id,
      'display_name',     v_user_name,
      'email',            v_user_email,
      'role',             v_user_role,
      'verification_gate', jsonb_build_object(
        'email_verified',    NEW.email_verified,
        'phone_verified',    NEW.phone_verified,
        'payment_added',     NEW.payment_method_added,
        'id_verified',       NEW.id_verified,
        'stripe_onboarded',  NEW.stripe_onboarded
      )
    )
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS verification_event_logger ON verification_gates;
CREATE TRIGGER verification_event_logger
AFTER UPDATE ON verification_gates
FOR EACH ROW
EXECUTE FUNCTION log_verification_event();

-- ─── 3. Review submitted trigger ─────────────────────────────────────

CREATE OR REPLACE FUNCTION log_review_event()
RETURNS TRIGGER AS $$
DECLARE
  v_driver_name  TEXT;
  v_host_name    TEXT;
  v_charger_name TEXT;
BEGIN
  SELECT display_name INTO v_driver_name FROM profiles WHERE id = NEW.driver_user_id;
  SELECT display_name INTO v_host_name   FROM profiles WHERE id = NEW.host_user_id;
  SELECT name INTO v_charger_name        FROM chargers WHERE id = NEW.charger_id;

  INSERT INTO platform_events (
    event_type, actor_user_id, actor_role, target_type, target_id,
    metadata
  ) VALUES (
    'review.submitted',
    NEW.driver_user_id,
    'driver',
    'review',
    NEW.id,
    jsonb_build_object(
      'review_id',    NEW.id,
      'booking_id',   NEW.booking_id,
      'charger_id',   NEW.charger_id,
      'charger_name', v_charger_name,
      'driver_id',    NEW.driver_user_id,
      'driver_name',  v_driver_name,
      'host_id',      NEW.host_user_id,
      'host_name',    v_host_name,
      'rating',       NEW.rating,
      'comment',      LEFT(COALESCE(NEW.comment, ''), 200)
    )
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS review_event_logger ON reviews;
CREATE TRIGGER review_event_logger
AFTER INSERT ON reviews
FOR EACH ROW
EXECUTE FUNCTION log_review_event();
