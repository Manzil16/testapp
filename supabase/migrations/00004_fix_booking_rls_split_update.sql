-- ============================================================
-- Migration 00004: Fix booking RLS — split UPDATE policy by role
-- Issue #11: Driver could self-complete bookings (financial exploit)
-- ============================================================

-- Drop the overly permissive UPDATE policy
DROP POLICY IF EXISTS "Booking parties can update" ON public.bookings;

-- Host can approve, decline, complete, or mark in_progress
CREATE POLICY "Host can manage booking status" ON public.bookings
  FOR UPDATE TO authenticated
  USING (host_id = auth.uid())
  WITH CHECK (
    host_id = auth.uid()
    AND status IN ('approved', 'declined', 'completed', 'in_progress')
  );

-- Driver can only cancel their own booking
CREATE POLICY "Driver can cancel own booking" ON public.bookings
  FOR UPDATE TO authenticated
  USING (driver_id = auth.uid())
  WITH CHECK (
    driver_id = auth.uid()
    AND status = 'cancelled'
  );

-- Admin can update any booking (for support escalations)
CREATE POLICY "Admin can update any booking" ON public.bookings
  FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
  ));
