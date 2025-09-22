Title: Structured Error Codes — Items, Customers, Orders

Status: Accepted

Summary:
- Extend structured, field-specific error codes to Items, Customers, and Orders.
- Keep routes thin and map model validation messages to codes.

Acceptance Criteria:
- Items POST/PUT return 400 with error.code = 'ITEM_VALIDATION_FAILED' and details [{ code, field, message }]. Duplicate SKU uses 'ITEM_SKU_EXISTS'.
- Items PATCH /:id/stock returns structured errors for business rules with codes like: ITEM_STOCK_COMPOSITE_FORBIDDEN, ITEM_STOCK_QUANTITY_NEGATIVE, ITEM_NOT_FOUND.
- Customers POST/PUT return 400 with error.code = 'CUSTOMER_VALIDATION_FAILED' and details. PATCH contact/billing return 'CUSTOMER_CONTACT_VALIDATION_FAILED' / 'CUSTOMER_BILLING_VALIDATION_FAILED' with details.
- Orders POST/PUT return 400 with error.code = 'ORDER_VALIDATION_FAILED' and details. Create errors map specific domain issues: inactive/not-found entities, date range.
 - Order Lines (POST/PUT/DELETE) return structured errors with codes like: ORDER_LINE_ITEM_ID_REQUIRED, ORDER_LINE_QUANTITY_POSITIVE, ORDER_LINE_PRICE_NONNEGATIVE, ORDER_NOT_DRAFT, ORDER_LINE_ITEM_ALREADY_EXISTS, ORDER_LINE_ITEM_NOT_FOUND, ORDER_NOT_FOUND, ITEM_NOT_FOUND.

Notes:
- Mapping is based on current model validation messages to avoid deep refactors.
