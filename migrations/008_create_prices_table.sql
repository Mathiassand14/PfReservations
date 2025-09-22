-- Prices table for item Start/Daily/Hourly amounts
CREATE TABLE IF NOT EXISTS prices (
  id SERIAL PRIMARY KEY,
  item_id INTEGER NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  kind VARCHAR(16) NOT NULL CHECK (kind IN ('Start','Daily','Hourly')),
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  UNIQUE(item_id, kind)
);

-- NOTE: Enforcement that composite items cannot have direct prices
-- and Hourly only for services requires triggers; to be added later if needed.

