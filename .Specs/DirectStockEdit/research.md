Research

- Existing UI has a Stock modal supporting delta adjustments with reasons.
- Backend exposes:
  - POST `/api/items/:id/stock-adjustment` for delta (requires reason)
  - PATCH `/api/items/:id/stock` for exact set (no reason; notes allowed)
- InventoryService.updateStockQuantity records an adjustment stock movement with notes.

Conclusion: No backend change required; simply wire UI to PATCH for Set mode.

