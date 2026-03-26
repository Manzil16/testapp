-- ============================================================
-- Migration 00014: Real verification rubric scoring
-- Issue #15: verification_score was just a hardcoded boolean (92 = approved)
-- Now: composite score from 5 rubric components (0-20 each, total 0-100)
-- ============================================================

-- Add rubric component columns to chargers
ALTER TABLE public.chargers
  ADD COLUMN rubric_photo_quality INTEGER NOT NULL DEFAULT 0 CHECK (rubric_photo_quality BETWEEN 0 AND 20),
  ADD COLUMN rubric_plug_verified INTEGER NOT NULL DEFAULT 0 CHECK (rubric_plug_verified IN (0, 20)),
  ADD COLUMN rubric_location_accuracy INTEGER NOT NULL DEFAULT 0 CHECK (rubric_location_accuracy BETWEEN 0 AND 20),
  ADD COLUMN rubric_host_response INTEGER NOT NULL DEFAULT 0 CHECK (rubric_host_response BETWEEN 0 AND 20),
  ADD COLUMN rubric_admin_review INTEGER NOT NULL DEFAULT 0 CHECK (rubric_admin_review IN (0, 20));

-- Update verification_score to be computed from rubric components
-- (keep as a regular column for backward compat, updated via trigger)
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

CREATE TRIGGER set_verification_score
  BEFORE INSERT OR UPDATE OF rubric_photo_quality, rubric_plug_verified,
    rubric_location_accuracy, rubric_host_response, rubric_admin_review
  ON public.chargers
  FOR EACH ROW
  EXECUTE FUNCTION public.compute_verification_score();

-- Migrate existing approved chargers to have rubric scores
UPDATE public.chargers
  SET rubric_photo_quality = 18,
      rubric_plug_verified = 20,
      rubric_location_accuracy = 18,
      rubric_host_response = 18,
      rubric_admin_review = 20
  WHERE status = 'approved';
