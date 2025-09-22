# Quickstart — Pricing & Order Time Feature

## Import Catalog from CSV
1) Place `CurrentItems.csv` in repo root.
2) Run the import CLI (to be added):
   - `node bin/pricing-import.js --file CurrentItems.csv`
3) Review summary: created/updated items, derived Internal rebate (%), skipped rows.

## Create Order & Auto-Calculate
- POST `/api/orders` with `order_start`, `order_end`, optional `setup_start`, `cleanup_end`, and lines.
- Status `Draft` and `Reserved` auto-calculate totals; `Dispatched` does not.

## Recalculate
- POST `/api/orders/:id/recalculate` to refresh totals using current base prices and the order’s captured rebate context.
- GET `/api/calendar/internal` returns internal schedule blocks (Setup, Order, Cleanup) over the extended window.

## Notes
- Currency: DKK; VAT-exclusive.
- Services (Hourly) billed in 15-min increments, rounded up; never discounted; no inventory impact.
- Composites have no direct price; totals derive from components.
- Availability: Items are out from `setup_start` (or `order_start` if missing) to `cleanup_end` (or `order_end`).
