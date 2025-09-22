Feature Tasks — CompositeStockCalculation

- [x] T001: Add composite stock calculation service method
  - [x] T001-01: Support repo injection for tests [P]
  - [x] T001-02: Implement calculateCompositeStock with status/limiting component
- [x] T002: Update InventoryService stock summary for composites
  - [x] T002-01: Inject ItemComponentService
  - [x] T002-02: Include isCalculated flag and method
- [x] T003: Update stock-movements summary route to branch for composites
  - [x] T003-01: Add ItemComponentService to route [P]
  - [x] T003-02: Return currentStock with isCalculated flag
- [x] T004: Spec docs added under .Specs/CompositeStockCalculation
  - [x] T004-01: spec.md, plan.md, research.md, data-model.md, quickstart.md
  - [x] T004-02: contracts/stock-summary.json
  - [x] T004-03: finalize tasks index

Dependencies
- T002 depends on T001
- T003 depends on T001
