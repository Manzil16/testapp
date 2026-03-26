-- ============================================================
-- VehicleGrid — Combined migrations 00004–00014
-- Paste this entire script into Supabase SQL Editor and run it.
-- ============================================================

-- 00004: Fix booking RLS — split UPDATE policy by role
DROP POLICY IF EXISTS "Booking parties can update" ON public.bookings;

CREATE POLICY "Host can manage booking status" ON public.bookings
  FOR UPDATE TO authenticated
  USING (host_id = auth.uid())
  WITH CHECK (
    host_id = auth.uid()
    AND status IN ('approved', 'declined', 'completed', 'in_progress')
  );

CREATE POLICY "Driver can cancel own booking" ON public.bookings
  FOR UPDATE TO authenticated
  USING (driver_id = auth.uid())
  WITH CHECK (
    driver_id = auth.uid()
    AND status = 'cancelled'
  );

CREATE POLICY "Admin can update any booking" ON public.bookings
  FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
  ));

-- 00005: Fix booking amount columns
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS subtotal_amount NUMERIC(10,2) NOT NULL DEFAULT 0;

UPDATE public.bookings SET subtotal_amount = total_amount WHERE subtotal_amount = 0;
UPDATE public.bookings SET total_amount = subtotal_amount + platform_fee;

-- 00007: Add payment_status column
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS payment_status TEXT NOT NULL DEFAULT 'pending';

-- (Skip CHECK constraint if column already exists with different definition)
DO $$
BEGIN
  ALTER TABLE public.bookings ADD CONSTRAINT bookings_payment_status_check
    CHECK (payment_status IN ('pending', 'authorized', 'captured', 'failed', 'refunded', 'cancelled'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 00008: Add cancelled_at
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ;

-- 00010: Dual role flags
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_driver BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS is_host BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT false;

UPDATE public.profiles SET is_driver = true WHERE role IN ('driver', 'admin');
UPDATE public.profiles SET is_host = true WHERE role IN ('host', 'admin');
UPDATE public.profiles SET is_admin = true WHERE role = 'admin';

-- 00011: Price constraint
DO $$
BEGIN
  ALTER TABLE public.chargers ADD CONSTRAINT reasonable_price
    CHECK (price_per_kwh >= 0.20 AND price_per_kwh <= 2.50);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 00012: Soft-delete + preserve bookings
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE public.chargers ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- Note: FK changes require dropping and re-adding constraints.
-- Only run these if the constraints still have CASCADE behavior.
-- If you get errors on these, the constraints may have already been changed.
DO $$
BEGIN
  ALTER TABLE public.bookings DROP CONSTRAINT IF EXISTS bookings_charger_id_fkey;
  ALTER TABLE public.bookings ALTER COLUMN charger_id DROP NOT NULL;
  ALTER TABLE public.bookings ADD CONSTRAINT bookings_charger_id_fkey
    FOREIGN KEY (charger_id) REFERENCES public.chargers(id) ON DELETE SET NULL;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE public.bookings DROP CONSTRAINT IF EXISTS bookings_host_id_fkey;
  ALTER TABLE public.bookings ALTER COLUMN host_id DROP NOT NULL;
  ALTER TABLE public.bookings ADD CONSTRAINT bookings_host_id_fkey
    FOREIGN KEY (host_id) REFERENCES public.profiles(id) ON DELETE SET NULL;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE public.bookings DROP CONSTRAINT IF EXISTS bookings_driver_id_fkey;
  ALTER TABLE public.bookings ALTER COLUMN driver_id DROP NOT NULL;
  ALTER TABLE public.bookings ADD CONSTRAINT bookings_driver_id_fkey
    FOREIGN KEY (driver_id) REFERENCES public.profiles(id) ON DELETE SET NULL;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- 00014: Verification rubric
ALTER TABLE public.chargers
  ADD COLUMN IF NOT EXISTS rubric_photo_quality INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rubric_plug_verified INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rubric_location_accuracy INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rubric_host_response INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rubric_admin_review INTEGER NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.compute_verification_score()
RETURNS TRIGGER AS $$
BEGIN
  NEW.verification_score := NEW.rubric_photo_quality
    + NEW.rubric_plug_verified
    + NEW.rubric_location_accuracy
    + NEW.rubric_host_response
    + NEW.rubric_admin_review;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_verification_score ON public.chargers;
CREATE TRIGGER set_verification_score
  BEFORE INSERT OR UPDATE OF rubric_photo_quality, rubric_plug_verified,
    rubric_location_accuracy, rubric_host_response, rubric_admin_review
  ON public.chargers
  FOR EACH ROW
  EXECUTE FUNCTION public.compute_verification_score();

-- Soft-delete function
CREATE OR REPLACE FUNCTION public.soft_delete_host(host_uuid UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE public.profiles
  SET deleted_at = NOW(), email = '[deleted]', display_name = '[deleted]',
      phone = NULL, avatar_url = NULL
  WHERE id = host_uuid;
  UPDATE public.chargers SET deleted_at = NOW(), status = 'rejected'
  WHERE host_id = host_uuid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Booking expiry trigger (prevents approving expired bookings)
CREATE OR REPLACE FUNCTION public.prevent_approve_expired()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'approved' AND OLD.expires_at IS NOT NULL AND OLD.expires_at < NOW() AND OLD.status = 'requested' THEN
    RAISE EXCEPTION 'Cannot approve an expired booking';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS check_booking_not_expired ON public.bookings;
CREATE TRIGGER check_booking_not_expired
  BEFORE UPDATE ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_approve_expired();

-- Done!
-- Note: PostGIS (migration 00013) and btree_gist double-booking (00006)
-- and pg_cron (00009) require extensions that may need to be enabled
-- in your Supabase dashboard under Database > Extensions first.
