-- Announcements table for live notices / promos / warnings
CREATE TABLE IF NOT EXISTS announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'info' CHECK (type IN ('info', 'warning', 'promo')),
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can read active announcements
CREATE POLICY "Anyone can read active announcements"
  ON announcements FOR SELECT
  USING (active = true);

-- Only admins (via service role or future admin check) can insert/update
-- For now, allow all authenticated users to read only
CREATE POLICY "Service role can manage announcements"
  ON announcements FOR ALL
  USING (auth.role() = 'service_role');
