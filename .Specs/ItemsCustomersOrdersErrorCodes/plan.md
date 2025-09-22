Plan

Steps:
1) Items: add mapItemValidationErrors; apply to POST/PUT; rename duplicate SKU code.
2) Customers: add mapCustomerValidationErrors; apply to POST/PUT; validate PATCH contact/billing with structured codes.
3) Orders: add mapOrderValidationErrors; pre-validate POST; map service errors; apply to PUT.
4) Frontend: include details in toasts for items/customers/orders save flows.

Rationale:
- Non-invasive, message-to-code mapping at route layer maintains current model contracts and tests.

