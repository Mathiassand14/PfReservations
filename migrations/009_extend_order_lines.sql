-- Order lines table (separate from legacy order_rows)
CREATE TABLE IF NOT EXISTS order_lines (
  id SERIAL PRIMARY KEY,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  item_id INTEGER NULL REFERENCES items(id),
  line_type VARCHAR(16) NOT NULL CHECK (line_type IN ('Equipment','Service')),
  kind VARCHAR(16) NOT NULL CHECK (kind IN ('Start','Daily','Hourly')),
  quantity NUMERIC(12,2) NOT NULL DEFAULT 1,
  hours NUMERIC(12,2) NULL,
  unit_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  rebate_applied NUMERIC(5,2) NOT NULL DEFAULT 0,
  override_reason TEXT NULL
);

