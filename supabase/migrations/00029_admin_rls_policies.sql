-- ============================================================
-- Migration 00029: Admin RLS policies for suspend & delete
-- Fixes admin panel bugs where suspend/delete buttons silently
-- succeed but do nothing. Root cause: no RLS policy allowed the
-- admin to UPDATE another user's row or DELETE profiles/chargers,
-- so Supabase returned 0 rows affected with no error.
-- ============================================================

-- ─── PROFILES ────────────────────────────────────────────────
-- Allow admins to update any profile (needed for is_suspended toggle).
DROP POLICY IF EXISTS "Admins can update any profile" ON public.profiles;
CREATE POLICY "Admins can update any profile" ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.is_admin = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.is_admin = true
    )
  );

-- Allow admins to delete any profile.
-- Foreign keys from bookings/chargers/reviews use ON DELETE SET NULL
-- (migration 00012), so this preserves booking history.
DROP POLICY IF EXISTS "Admins can delete any profile" ON public.profiles;
CREATE POLICY "Admins can delete any profile" ON public.profiles
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.is_admin = true
    )
  );

-- ─── CHARGERS ────────────────────────────────────────────────
-- Allow admins to delete any charger.
-- Bookings FK has ON DELETE SET NULL, so historical bookings survive.
DROP POLICY IF EXISTS "Admins can delete any charger" ON public.chargers;
CREATE POLICY "Admins can delete any charger" ON public.chargers
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.is_admin = true
    )
  );
