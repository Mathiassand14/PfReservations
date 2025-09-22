Quickstart

Item create (missing fields)

POST /api/items { "sku": "A-1" }
=> 400 { error: { code: "ITEM_VALIDATION_FAILED", details: [{ code: "ITEM_NAME_REQUIRED", field: "name", ... }] } }

Customer create (bad email)

POST /api/customers { "displayName": "Acme", "contactInfo": { "email": "bad" } }
=> 400 { error: { code: "CUSTOMER_VALIDATION_FAILED", details: [{ code: "CUSTOMER_CONTACT_EMAIL_INVALID", field: "contactInfo.email" }] } }

Order create (missing customerId)

POST /api/orders { "salesPersonId": 1, "startDate": "2025-01-01", "returnDueDate": "2025-01-02" }
=> 400 { error: { code: "ORDER_VALIDATION_FAILED", details: [{ code: "ORDER_CUSTOMER_ID_REQUIRED", field: "customerId" }] } }

Order line add (duplicate item in order)

POST /api/orders/42/lines { "itemId": 7, "quantity": 1, "pricePerDay": 15 }
=> 409 { error: { code: "ORDER_LINE_ITEM_ALREADY_EXISTS", details: [{ code: "ORDER_LINE_ITEM_ALREADY_EXISTS", field: "itemId" }] } }

Item stock set (composite item)

PATCH /api/items/5/stock { "quantity": 10, "createdBy": "Web" }
=> 400 { error: { code: "ITEM_STOCK_COMPOSITE_FORBIDDEN", details: [{ code: "ITEM_STOCK_COMPOSITE_FORBIDDEN", field: "itemId" }] } }
