# Contract — CSV Import

Request (CLI)
- Command: `node bin/pricing-import.js --file CurrentItems.csv`

CSV Columns
- `Vare#` → `items.legacy_code` (optional reference)
- `Vare` → `items.name` (string; may include “(Intern|Ekstern, Start|Dagspris)” or “pr. time”)
- `Priser` → numeric amount (DKK, VAT-excl)

Behavior
- Create/Update base prices by `name` and kind:
  - Kind is parsed from `Vare`: `Start`, `Dagspris` → `Daily`, and `pr. time` → `Hourly` (services only)
- Derive Internal rebate percent once as the average discount across pairs where both Intern/Ekstern exist for Start/Daily. Exclude Hourly. Ekstern = 0%.
- No SKUs are created/changed. Composite items must have no direct prices.

Output (stdout JSON summary)
 - total_rows, created_items, updated_items
 - derived_internal_rebate_percent
 - errors: [{row, message}]
