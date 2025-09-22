# Research & Decisions

## Open Questions
- Timezone storage for order timestamps (setup/order/cleanup): use UTC in DB, convert at UI. Validate no regressions in ICS feeds.
- Monetary rounding: adopt round-half-up to 2 decimals; confirm with finance.
- Import batching & transactions: choose batch size (e.g., 500) and wrap each batch in a TX.

## Spike Ideas
- Create a tiny fixture CSV (10 rows) to validate rebate derivation math (average percent across Intern/Ekstern Start/Daily pairs).
- Benchmark calculation for 1k-line orders (synthetic) to confirm O(n) behavior acceptable.

## Out of Scope
- Effective-dated pricing; multi-currency.
