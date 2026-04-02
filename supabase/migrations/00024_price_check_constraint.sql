-- Migration 00024: Charger price_per_kwh check constraint
-- Enforces AppConfig.CHARGER_DEFAULTS bounds: min 0.35, max 2.50
-- Replaces any prior price constraint (migration 00011 may have had a looser one).

-- Drop previous constraint if it exists (any name)
DO $$
DECLARE
  v_constraint TEXT;
BEGIN
  SELECT conname INTO v_constraint
  FROM pg_constraint
  WHERE conrelid = 'chargers'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) ILIKE '%price_per_kwh%'
  LIMIT 1;

  IF v_constraint IS NOT NULL THEN
    EXECUTE format('ALTER TABLE chargers DROP CONSTRAINT %I', v_constraint);
  END IF;
END $$;

-- Add the definitive constraint aligned with AppConfig.CHARGER_DEFAULTS
ALTER TABLE chargers
  ADD CONSTRAINT chargers_price_per_kwh_range
  CHECK (price_per_kwh >= 0.35 AND price_per_kwh <= 2.50);

-- Note: this constraint is enforced at the DB level and cannot be bypassed
-- by the Supabase JS client or any edge function. RLS policies control
-- who can INSERT/UPDATE rows, while this CHECK ensures the value is valid.
