-- ============================================================
-- Migration 00013: PostGIS spatial queries for viewport-based charger loading
-- Issue #16: listAllChargers fetches everything — freezes UI with many markers
-- ============================================================

CREATE EXTENSION IF NOT EXISTS postgis;

-- Add geometry column
ALTER TABLE public.chargers
  ADD COLUMN location_point geometry(Point, 4326);

-- Populate from existing lat/lon
UPDATE public.chargers
  SET location_point = ST_SetSRID(ST_MakePoint(longitude, latitude), 4326);

-- Spatial index for fast viewport queries
CREATE INDEX idx_chargers_location_point ON public.chargers USING GIST(location_point);

-- RPC function: get chargers within map viewport bounds
CREATE OR REPLACE FUNCTION public.chargers_in_bounds(
  min_lat DOUBLE PRECISION,
  max_lat DOUBLE PRECISION,
  min_lng DOUBLE PRECISION,
  max_lng DOUBLE PRECISION,
  max_results INTEGER DEFAULT 200
)
RETURNS SETOF public.chargers
LANGUAGE sql STABLE
AS $$
  SELECT *
  FROM public.chargers
  WHERE status = 'approved'
    AND deleted_at IS NULL
    AND location_point && ST_MakeEnvelope(min_lng, min_lat, max_lng, max_lat, 4326)
  ORDER BY updated_at DESC
  LIMIT max_results;
$$;

-- Trigger to auto-update location_point when lat/lon changes
CREATE OR REPLACE FUNCTION public.sync_charger_location_point()
RETURNS TRIGGER AS $$
BEGIN
  NEW.location_point := ST_SetSRID(ST_MakePoint(NEW.longitude, NEW.latitude), 4326);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_charger_location_point
  BEFORE INSERT OR UPDATE OF latitude, longitude ON public.chargers
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_charger_location_point();
