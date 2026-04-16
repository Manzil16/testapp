-- Migration 00027: pgvector extension + embedding columns (AI readiness)
-- Enables semantic charger search and smart route recommendations via AIService.ts (future).
-- No existing queries are affected — embedding columns are nullable and opt-in.
--
-- Architecture note:
-- When AIService.ts is added, it calls existing ChargerService and RouteService.
-- It reads data through the same repositories. Zero schema changes needed beyond this migration.
-- pgvector match functions below are the only new entry points.

CREATE EXTENSION IF NOT EXISTS vector;

-- Charger embeddings: semantic search over charger name + address + amenities + specs
ALTER TABLE public.chargers
  ADD COLUMN IF NOT EXISTS embedding vector(1536);

-- Index: IVFFlat for fast approximate nearest-neighbour on chargers
-- lists=100 is appropriate for up to ~1M rows; rebuild with larger lists value if needed
CREATE INDEX IF NOT EXISTS idx_chargers_embedding
  ON public.chargers
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- Trip/route embeddings: match past routes to find similar journeys (future smart suggestions)
-- Trips table may not exist yet — guard with DO block
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'trips'
  ) THEN
    ALTER TABLE public.trips
      ADD COLUMN IF NOT EXISTS route_embedding vector(1536);

    CREATE INDEX IF NOT EXISTS idx_trips_route_embedding
      ON public.trips
      USING ivfflat (route_embedding vector_cosine_ops)
      WITH (lists = 100);
  END IF;
END $$;

-- match_chargers: semantic similarity search
-- Called by AIService.ts with an embedding generated from user's search intent.
-- Returns chargers ordered by cosine similarity, filtered to approved and active only.
CREATE OR REPLACE FUNCTION match_chargers(
  query_embedding  vector(1536),
  match_threshold  FLOAT DEFAULT 0.70,
  match_count      INT   DEFAULT 10
)
RETURNS TABLE (
  id            UUID,
  name          TEXT,
  address       TEXT,
  latitude      DOUBLE PRECISION,
  longitude     DOUBLE PRECISION,
  max_power_kw  NUMERIC,
  price_per_kwh NUMERIC,
  connector_type TEXT,
  similarity    FLOAT
) AS $$
  SELECT
    c.id,
    c.name,
    c.address,
    c.latitude,
    c.longitude,
    c.max_power_kw,
    c.price_per_kwh,
    c.connector_type,
    1 - (c.embedding <=> query_embedding) AS similarity
  FROM public.chargers c
  WHERE
    c.deleted_at IS NULL
    AND c.status = 'approved'
    AND c.embedding IS NOT NULL
    AND 1 - (c.embedding <=> query_embedding) > match_threshold
  ORDER BY c.embedding <=> query_embedding
  LIMIT match_count;
$$ LANGUAGE sql STABLE;

GRANT EXECUTE ON FUNCTION match_chargers(vector, FLOAT, INT) TO authenticated, service_role;
