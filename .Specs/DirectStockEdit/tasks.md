Tasks — DirectStockEdit

- [x] T001: Author spec.md, plan.md, research.md, data-model.md, quickstart.md, and contracts/ui-set-exact-stock.md
  - [x] T001-01: Capture acceptance criteria and UX details
  - [x] T001-02: Document API usage and error handling
- [x] T002: Implement UI mode toggle in Adjust Stock modal
  - [x] T002-01: Add Adjustment Mode select (Delta vs Set)
  - [x] T002-02: Toggle form fields and required attributes per mode
- [x] T003: Wire Apply action per mode
  - [x] T003-01: POST /stock-adjustment for Delta mode (existing)
  - [x] T003-02: PATCH /stock for Set mode with notes
- [x] T004: Preview computation for both modes
  - [x] T004-01: Compute delta and new total for Set mode
  - [x] T004-02: Guard against negative results
- [x] T005: Validation updates
  - [x] T005-01: Ensure required fields per mode and min constraints
- [x] T006: Update quickstart with manual test steps

