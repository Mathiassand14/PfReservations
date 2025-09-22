Plan

Goals:
- Compute composite availability and return it with an identifier.
- Keep routes thin; use services for business logic.

Steps:
1) Add `calculateCompositeStock(itemId)` to `ItemComponentService` (detailed result with status and limiting component).
2) Allow repo injection in the service constructor for tests.
3) Update `InventoryService.getStockSummary` to support composites and add `isCalculated` flag.
4) Update `routes/stock-movements` summary endpoint to return calculated stock for composites with identifier.
5) Validate response shapes; leave other endpoints unchanged.

Tradeoffs:
- Did not add list-level composite stock to keep compatibility (can be added later).

Upstream Import Notes:
- No `.kiro` conflicts observed; this plan follows existing architecture and acceptance.

