-- Migration 00026: rank_chargers_for_route() DB function
-- Returns chargers ranked by proximity to a driving route line + power + availability.
-- Called by the route-plan edge function to recommend charging stops.

CREATE OR REPLACE FUNCTION rank_chargers_for_route(
  p_origin_lat      FLOAT,
  p_origin_lng      FLOAT,
  p_dest_lat        FLOAT,
  p_dest_lng        FLOAT,
  p_connector_type  TEXT,
  p_max_results     INT DEFAULT 5
)
RETURNS TABLE (
  charger_id    UUID,
  name          TEXT,
  address       TEXT,
  latitude      DOUBLE PRECISION,
  longitude     DOUBLE PRECISION,
  max_power_kw  NUMERIC,
  price_per_kwh NUMERIC,
  distance_km   NUMERIC,
  score         NUMERIC
) AS $$
DECLARE
  v_route_line geometry;
BEGIN
  -- Build a 2D line from origin to destination (used for perpendicular distance calc)
  v_route_line := ST_MakeLine(
    ST_SetSRID(ST_MakePoint(p_origin_lng, p_origin_lat), 4326),
    ST_SetSRID(ST_MakePoint(p_dest_lng,   p_dest_lat),   4326)
  );

  RETURN QUERY
  SELECT
    c.id                                                              AS charger_id,
    c.name,
    c.address,
    c.latitude,
    c.longitude,
    c.max_power_kw,
    c.price_per_kwh,
    ROUND(
      (ST_Distance(c.location_point::geography,
                   ST_ClosestPoint(v_route_line, c.location_point)::geography) / 1000.0)::NUMERIC,
      2
    )                                                                 AS distance_km,
    ROUND(
      (
        -- Proximity score (0–50): closer to route = better
        GREATEST(0, 50 - ST_Distance(
          c.location_point::geography,
          ST_ClosestPoint(v_route_line, c.location_point)::geography
        ) / 300.0)
        +
        -- Power score (0–30): higher kW = faster charge = better
        LEAST(30, c.max_power_kw * 0.5)
        +
        -- Price score (0–20): lower price = better (assumes max meaningful price ~$1.50/kWh)
        GREATEST(0, 20 - c.price_per_kwh * 14)
      )::NUMERIC,
      2
    )                                                                 AS score
  FROM public.chargers c
  WHERE
    c.deleted_at IS NULL
    AND c.status = 'approved'
    AND (p_connector_type IS NULL OR c.connector_type = p_connector_type)
    -- Only chargers within 15km perpendicular to the route line
    AND ST_DWithin(
      c.location_point::geography,
      ST_ClosestPoint(v_route_line, c.location_point)::geography,
      15000
    )
    -- Only chargers that lie between origin and destination (not behind start or past end)
    AND ST_LineLocatePoint(v_route_line, c.location_point) BETWEEN 0.05 AND 0.95
  ORDER BY score DESC
  LIMIT p_max_results;
END;
$$ LANGUAGE plpgsql STABLE;

-- Grant execute to authenticated users (called via RPC from edge function with service role)
GRANT EXECUTE ON FUNCTION rank_chargers_for_route(FLOAT, FLOAT, FLOAT, FLOAT, TEXT, INT)
  TO authenticated, service_role;
