Contract: UI — Set Exact Stock

Given
- An atomic item exists with current stock S (S ≥ 0)

When
- User opens Adjust Stock and selects Adjustment Mode = Set exact stock
- Enters New Stock = N (N ≥ 0) and Notes
- Clicks Apply

Then
- UI calls PATCH /api/items/:id/stock with { quantity: N, notes, createdBy }
- Preview shows Current=S, Change=(N−S with sign), New Total=N
- On success, item stock becomes exactly N

Validation
- New Stock required; min=0; integer permitted (browser number input)
- Notes required

Errors
- If API returns error, show toast with message and details if provided

