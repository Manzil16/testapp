-- ============================================================
-- Migration 00010: Replace single role column with boolean flags
-- Issue #14: Users can't be both driver and host
-- ============================================================

-- Add boolean role flags
ALTER TABLE public.profiles
  ADD COLUMN is_driver BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN is_host BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN is_admin BOOLEAN NOT NULL DEFAULT false;

-- Migrate existing data from role column
UPDATE public.profiles SET is_driver = true WHERE role IN ('driver', 'admin');
UPDATE public.profiles SET is_host = true WHERE role IN ('host', 'admin');
UPDATE public.profiles SET is_admin = true WHERE role = 'admin';

-- Update RLS policies that reference role = 'admin'

-- Chargers: admin view policy
DROP POLICY IF EXISTS "Anyone can view approved chargers" ON public.chargers;
CREATE POLICY "Anyone can view approved chargers" ON public.chargers
  FOR SELECT USING (
    status = 'approved'
    OR host_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
  );

DROP POLICY IF EXISTS "Admins can update any charger" ON public.chargers;
CREATE POLICY "Admins can update any charger" ON public.chargers
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
  );

-- Verification requests: admin policies
DROP POLICY IF EXISTS "Hosts can view own verifications" ON public.verification_requests;
CREATE POLICY "Hosts can view own verifications" ON public.verification_requests
  FOR SELECT USING (
    host_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
  );

DROP POLICY IF EXISTS "Admins can update verifications" ON public.verification_requests;
CREATE POLICY "Admins can update verifications" ON public.verification_requests
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
  );

-- Bookings: admin policy (from migration 00004)
DROP POLICY IF EXISTS "Admin can update any booking" ON public.bookings;
CREATE POLICY "Admin can update any booking" ON public.bookings
  FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
  );

-- Keep the role column for backward compat during transition but it's no longer authoritative
-- The role column will be deprecated — boolean flags are the source of truth
