Quickstart

GET /api/orders/42/lines

Response 200
{
  "orderId": 42,
  "lineItems": [
    { "id": 10, "itemId": 7, "itemName": "Laptop", "itemSku": "LAP-001", "quantity": 2, "pricePerDay": 25, "rentalDays": 3, "lineTotal": 150 }
  ],
  "count": 1
}

Response 404
{ "error": { "code": "ORDER_NOT_FOUND", "message": "Order not found" } }

