Quickstart

Examples

- GET /api/items/123/stock-summary
  - Composite: { item: {...}, currentQuantity: 4, isCalculated: true, stockCalculation: { method: 'composite_min_sets', availableQuantity: 4, limitingComponent: 'Monitor', stockStatus: 'in_stock' } }
  - Atomic: { item: {...}, currentQuantity: 10, isCalculated: false, stockCalculation: { ... }, stockStatus: 'in_stock' }

- GET /api/stock-movements/summary/123
  - { summary: [...], currentStock: { isCalculated: true, method: 'composite_min_sets', availableQuantity: 4, limitingComponent: 'Monitor', stockStatus: 'in_stock' }, itemId: 123 }

