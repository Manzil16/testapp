-- ============================================================
-- Migration 00012: Soft-delete + preserve booking history
-- Issue #20: Host account deletion wipes all driver bookings/reviews
-- ============================================================

-- Add soft-delete columns
ALTER TABLE public.profiles ADD COLUMN deleted_at TIMESTAMPTZ;
ALTER TABLE public.chargers ADD COLUMN deleted_at TIMESTAMPTZ;

-- Change booking FK on charger_id from CASCADE to SET NULL
ALTER TABLE public.bookings DROP CONSTRAINT bookings_charger_id_fkey;
ALTER TABLE public.bookings
  ADD CONSTRAINT bookings_charger_id_fkey
  FOREIGN KEY (charger_id) REFERENCES public.chargers(id)
  ON DELETE SET NULL;

-- Make charger_id nullable (needed for SET NULL)
ALTER TABLE public.bookings ALTER COLUMN charger_id DROP NOT NULL;

-- Change booking FK on host_id from CASCADE to SET NULL
ALTER TABLE public.bookings DROP CONSTRAINT bookings_host_id_fkey;
ALTER TABLE public.bookings
  ADD CONSTRAINT bookings_host_id_fkey
  FOREIGN KEY (host_id) REFERENCES public.profiles(id)
  ON DELETE SET NULL;
ALTER TABLE public.bookings ALTER COLUMN host_id DROP NOT NULL;

-- Change booking FK on driver_id from CASCADE to SET NULL
ALTER TABLE public.bookings DROP CONSTRAINT bookings_driver_id_fkey;
ALTER TABLE public.bookings
  ADD CONSTRAINT bookings_driver_id_fkey
  FOREIGN KEY (driver_id) REFERENCES public.profiles(id)
  ON DELETE SET NULL;
ALTER TABLE public.bookings ALTER COLUMN driver_id DROP NOT NULL;

-- Reviews: preserve even if charger/host is deleted
ALTER TABLE public.reviews DROP CONSTRAINT reviews_charger_id_fkey;
ALTER TABLE public.reviews
  ADD CONSTRAINT reviews_charger_id_fkey
  FOREIGN KEY (charger_id) REFERENCES public.chargers(id)
  ON DELETE SET NULL;
ALTER TABLE public.reviews ALTER COLUMN charger_id DROP NOT NULL;

-- Soft-delete function for hosts (call instead of DELETE)
CREATE OR REPLACE FUNCTION public.soft_delete_host(host_uuid UUID)
RETURNS VOID AS $$
BEGIN
  -- Anonymise PII
  UPDATE public.profiles
  SET deleted_at = NOW(),
      email = '[deleted]',
      display_name = '[deleted]',
      phone = NULL,
      avatar_url = NULL
  WHERE id = host_uuid;

  -- Deactivate chargers
  UPDATE public.chargers
  SET deleted_at = NOW(),
      status = 'rejected'
  WHERE host_id = host_uuid;

  -- Bookings and reviews remain intact for financial record retention
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Exclude soft-deleted chargers from public listing
DROP POLICY IF EXISTS "Anyone can view approved chargers" ON public.chargers;
CREATE POLICY "Anyone can view approved chargers" ON public.chargers
  FOR SELECT USING (
    deleted_at IS NULL
    AND (
      status = 'approved'
      OR host_id = auth.uid()
      OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
    )
  );
