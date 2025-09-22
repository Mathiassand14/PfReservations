tasta# Technical Plan — Pricing, Rebates, and Time Windows

## Technical Context
- Language: Node.js 18 (CommonJS), Express 4; Docker Compose runtime.
- Primary deps: `express`, `pg`, `dotenv`; tests: `jest`, `supertest`.
- Storage: PostgreSQL 15 (existing); add minimal columns/tables only.
- Target: Internal web app + CLI for CSV import; REST API for orders.
- Performance: O(n lines) per order calculation; CSV import ~1–5k rows.
- Constraints: Backward-compatible endpoints; composite items priced from components; services never discounted.
- Observability: Structured JSON logs (order_id, action, duration); unified across API/CLI.
- Versioning: Feature library 0.1.0; follow MAJOR.MINOR.BUILD for changes.

## Project Type & Structure
Single web app with the feature packaged as an internal library + CLI.
- `lib/pricing/` — calculation engine, CSV parser, rebate derivation
- `bin/pricing-import.js` — CLI to import `CurrentItems.csv`
- `routes/` — add `POST /api/orders/:id/recalculate`
- `tests/` — contract and integration tests
- `features/pricing-and-order-time/` — spec, plan, research, contracts, docs

## Constitution Check
- Simplicity: One project (+ tests); single data model.
- Architecture: Library-first (`lib/pricing`) with CLI and docs.
- Testing: RED→GREEN→Refactor; contract + integration tests first.
- Observability: Add JSON logger helper and use consistently.
- Versioning: Start 0.1.0; document breaking schema changes.

## Unknowns & Research Tasks
- Timezone handling for the 4 timestamps; propose UTC storage. [research]
- Monetary rounding strategy; default round-half-up to 2 decimals. [confirm]
- Import safety: transactional batches (e.g., 500 rows). [research]
- Items type migration strategy: introduce `items.type` with values ('Atomic','Composite','Service'); backfill from `is_composite` and any existing service flags; keep `is_composite` as shim for backward compatibility. [plan]

## Phase 0/1 Outputs
- research.md — decisions to validate and micro-experiments.
- data-model.md — schema deltas (orders, order_lines, customers, rebate_groups, items.type, prices) and constraints.
- quickstart.md — import CSV, create orders, recalc.
- contracts/ — examples for order create, calculation, recalc, CSV import.

## Steering Alignment (.kiro)
- Adopted: stack and practices from `.kiro/steering/tech.md` (Node.js 18, Postgres, tests, Docker), and structure guidance from `.kiro/steering/structure.md` where compatible.
- Precedence: This feature’s spec in `features/` overrides conflicting `.kiro` guidance unless the `.kiro` guidance is clearly better without violating acceptance criteria.
- Record merges in `features/steering-alignment.md` and note any conflicts resolved for this feature.

## Task Generation (deferred)
Tasks will be grouped (Setup, Tests, Core, Integration, Polish), numbered, parallelized where file-safe, and strictly test-first. Generated after `/tasks`.
