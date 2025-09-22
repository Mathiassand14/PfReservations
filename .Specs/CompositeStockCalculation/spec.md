Title: Composite Stock Calculation with Identifier

Status: Accepted

Summary:
- For composite items, calculate available stock based on components (min of floor(child_available/qty_required) across components).
- Expose this calculated value via existing endpoints with a clear identifier indicating it is calculated.

Scope:
- Endpoints: `GET /api/items/:id/stock-summary`, `GET /api/stock-movements/summary/:itemId`.
- Data model unchanged; uses existing `items` and `item_components`.

Acceptance Criteria:
- For a composite item:
  - `GET /api/items/:id/stock-summary` returns `isCalculated: true` and `currentQuantity` equal to the calculated availability. Include `stockCalculation.method = 'composite_min_sets'` and `stockCalculation.availableQuantity`.
  - `GET /api/stock-movements/summary/:itemId` returns `currentStock.isCalculated = true`, `currentStock.method = 'composite_min_sets'`, and `currentStock.availableQuantity`.
  - Include `limitingComponent` when identifiable.
- For an atomic item:
  - The same endpoints return `isCalculated: false` (or `currentStock.isCalculated = false`) and behave as before.

Out of Scope:
- UI changes, additional listing endpoints, nested composite edge-case reservations.

Notes:
- [NEEDS CLARIFICATION: Should composite stock appear in bulk stock-level lists? Default is no change.]

