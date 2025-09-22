Title: Structured Error Codes — Item Components and Stock Movements

Status: Accepted

Summary:
- Add structured, field-specific error codes to item component endpoints and stock movement endpoints.

Acceptance Criteria:
- Item components (POST/PUT/DELETE):
  - Return 4xx with error.code specific to the failure and details [{ code, field, message }].
  - Codes include: ITEM_COMPONENT_PARENT_OR_CHILD_REQUIRED, ITEM_COMPONENT_QUANTITY_POSITIVE, ITEM_COMPONENT_SELF_REFERENCE, ITEM_COMPONENT_PARENT_NOT_FOUND, ITEM_COMPONENT_PARENT_NOT_COMPOSITE, ITEM_COMPONENT_CHILD_NOT_FOUND, ITEM_COMPONENT_CHILD_NOT_ATOMIC, ITEM_COMPONENT_CYCLE_DETECTED, ITEM_COMPONENT_RELATIONSHIP_NOT_FOUND.
- Stock Movements:
  - POST /api/stock-movements returns structured errors for missing data and business rules with codes like: STOCK_COMPOSITE_FORBIDDEN, STOCK_REASON_INVALID, STOCK_NEGATIVE_RESULT, ITEM_NOT_FOUND.
  - Similar structured errors for /repair/send, /repair/return, /loss/report, /found/report.

