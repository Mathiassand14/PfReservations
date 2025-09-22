# Interface Tasks — PricingAndOrderTime

- [x] T018: Recalculate endpoint (API)
  - [x] T018-01: Add route and wire to OrderService.recalculate
  - [x] T018-02: Validate permissions and return updated totals
  - Files: `routes/orders-recalc.js` (new), `routes/orders.js` (mount POST `/api/orders/:id/recalculate`)
  - Call `OrderService.recalculate(id)`; return updated totals and `calculated_at`.
  - Depends on: T017
- [x] T022 [P]: Docs and quickstart refresh
  - [x] T022-01: Update .Specs quickstart for CLI and recalc
  - [x] T022-02: Update README with endpoint and availability notes
  - Files: `.Specs/PricingAndOrderTime/quickstart.md`, `README.md`
  - Document CLI usage, recalc endpoint, availability window behavior.
  - Depends on: T010, T018

- [x] T016c: UI — items.type dropdown and badges
  - [x] T016c-01: Map UI dropdown to 'Atomic' | 'Composite' | 'Service' persisted type
  - [x] T016c-02: Display type badges consistently in items list

- [x] T016e: Docs — items.type data model
  - [x] T016e-01: Update data-model.md and spec to include items.type and constraints
