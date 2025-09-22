Plan

Steps:
1) Add mapComponentError() in routes/items.js and wrap add/update/remove in try/catch.
2) Enhance items stock-adjustment route with structured error mapping (negative result, invalid reason, composite forbidden, not found).
3) Add mapStockError() to routes/stock-movements.js and return structured errors for all write endpoints.
4) Update UI to display error.details for component add/remove and stock adjustments.

