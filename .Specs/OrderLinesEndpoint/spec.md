Title: Order Lines Endpoint

Status: Accepted

Summary:
- Add GET /api/orders/:id/lines to return the order's line items in a UI-friendly shape with rentalDays precomputed.

Acceptance Criteria:
- 200 OK: { orderId, lineItems: [ { id, itemId, itemName, itemSku, quantity, pricePerDay, rentalDays, lineTotal } ], count }
- 404 when order not found with error.code = 'ORDER_NOT_FOUND'.

