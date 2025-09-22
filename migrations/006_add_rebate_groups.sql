-- Rebate groups and customer fields
CREATE TABLE IF NOT EXISTS rebate_groups (
  id SERIAL PRIMARY KEY,
  name VARCHAR(32) UNIQUE NOT NULL,
  percent NUMERIC(5,2) NOT NULL
);

-- Seed default groups
INSERT INTO rebate_groups(name, percent) VALUES ('Ekstern', 0.00)
ON CONFLICT (name) DO NOTHING;
INSERT INTO rebate_groups(name, percent) VALUES ('Internal', 0.00)
ON CONFLICT (name) DO NOTHING;

-- Extend customers
ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS rebate_group VARCHAR(32) NOT NULL DEFAULT 'Ekstern';

ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS rebate_percent_override NUMERIC(5,2) NULL;

