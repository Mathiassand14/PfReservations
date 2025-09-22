Data Model Impact

- No schema changes.
- Uses existing tables:
  - `items` (fields: `id`, `name`, `sku`, `type`, `is_composite`, `quantity_on_hand`, ...)
  - `item_components` (fields: `parent_id`, `child_id`, `quantity`)

Computation:
- availableQuantity = min over components of floor(child.available_quantity / component.quantity)

