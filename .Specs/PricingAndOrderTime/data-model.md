# Data Model — Deltas

Note: SQL shown conceptually; align with existing migrations style.

## customers
- Add: `rebate_group VARCHAR(32) NOT NULL DEFAULT 'Ekstern'` (values: Ekstern, Internal)
- Add: `rebate_percent_override NUMERIC(5,2)` (NULL = use group)

## rebate_groups (new)
- `id SERIAL PRIMARY KEY`
- `name VARCHAR(32) UNIQUE NOT NULL` (Ekstern, Internal)
- `percent NUMERIC(5,2) NOT NULL` (Ekstern = 0.00; Internal = derived)

## items
- Add: `type VARCHAR(16) NOT NULL DEFAULT 'Atomic'` CHECK (type IN ('Atomic','Composite','Service'))
- Ensure `is_composite BOOLEAN NOT NULL DEFAULT false` [DEPRECATED: replaced by `type`]
- Ensure `quantity_on_hand INTEGER NULL` (NULL for composites and services; 0 default allowed for atomic)
- Ensure `legacy_code VARCHAR(64) NULL` (from CSV Vare#)

## item_components
- Enforce: child must be Equipment (no Service components); parent must be `type='Composite'`

## prices (new or refactor existing if present)
- `id SERIAL PRIMARY KEY`
- `item_id INTEGER NOT NULL REFERENCES items(id)`
- `kind VARCHAR(16) NOT NULL` CHECK (kind IN ('Start','Daily','Hourly'))
- `amount NUMERIC(12,2) NOT NULL CHECK (amount > 0)`
- Unique `(item_id, kind)`
- Rule: No `prices` rows for composite items; Hourly only for Services

## orders
- Add: `status VARCHAR(16) NOT NULL` (Draft, Reserved, Dispatched)
- Add: `setup_start TIMESTAMPTZ NULL`
- Add: `order_start TIMESTAMPTZ NOT NULL`
- Add: `order_end TIMESTAMPTZ NOT NULL`
- Add: `cleanup_end TIMESTAMPTZ NULL`
- Add: `calculated_at TIMESTAMPTZ NULL`
- Add: `subtotal NUMERIC(12,2) NOT NULL DEFAULT 0`
- Add: `rebate_amount NUMERIC(12,2) NOT NULL DEFAULT 0`
- Add: `total_ex_vat NUMERIC(12,2) NOT NULL DEFAULT 0`
- Add: `captured_rebate_percent NUMERIC(5,2) NULL` (snapshot at creation)
- Validate: `order_end > order_start`; setup ≤ order_start; cleanup ≥ order_end

## order_lines (new or extend)
- `id SERIAL PRIMARY KEY`
- `order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE`
- `item_id INTEGER NULL REFERENCES items(id)`
- `line_type VARCHAR(16) NOT NULL` CHECK (line_type IN ('Equipment','Service'))
- `kind VARCHAR(16) NOT NULL` CHECK (kind IN ('Start','Daily','Hourly'))
- `quantity NUMERIC(12,2) NOT NULL DEFAULT 1` (for Start/Daily)
- `hours NUMERIC(12,2) NULL` (for Hourly; 15-min increments, rounded up)
- `unit_price NUMERIC(12,2) NOT NULL`
- `rebate_applied NUMERIC(5,2) NOT NULL DEFAULT 0` (0% for Services)
- `override_reason TEXT NULL` (if manually overridden)
- Constraint: Services cannot have `item_id` that is composite or stock-tracked; composites priced via components only (no direct lines)

## Calculation Rules (summary)
- Daily threshold on order window: first 24h free of Daily; then ceil per 24h
- Equipment gets rebate; Services never; composites sum component lines
- Hourly services round up to next 15 minutes
