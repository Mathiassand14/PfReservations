Quickstart

Item Components — Add invalid quantity

POST /api/items/10/components { "childId": 2, "quantity": 0 }
=> 400 { error: { code: "ITEM_COMPONENT_QUANTITY_POSITIVE", details: [{ code: "ITEM_COMPONENT_QUANTITY_POSITIVE", field: "quantity" }] } }

Stock Movement — Manual adjustment negative result

POST /api/stock-movements { itemId: 1, delta: -999, reason: "adjustment", createdBy: "Web", notes: "test" }
=> 400 { error: { code: "STOCK_NEGATIVE_RESULT", details: [{ code: "STOCK_NEGATIVE_RESULT", field: "delta" }] } }

