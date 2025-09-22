Title: Direct Stock Edit Mode

Summary
- Add an option in the “Adjust Stock” modal to directly set the stock to an exact number in addition to the existing increase/decrease by delta flow.

Motivation
- Current UI only supports delta adjustments with a reason. Users want to type the final desired stock number quickly when editing stock.

Scope
- Frontend only: `public/app.js` modal markup/logic.
- Use existing API: `PATCH /api/items/:id/stock` to set exact quantity; keep `POST /api/items/:id/stock-adjustment` for delta mode.

Non-Goals
- No backend API changes.
- No DB schema changes.

Acceptance Criteria
- In the Adjust Stock modal, a new “Adjustment Mode” control exists with two options:
  - Adjust by amount (+/-) [default]
  - Set exact stock
- When selecting “Adjust by amount (+/-)”, UI shows Quantity (number, min=1) and Direction (increase/decrease) and requires a Reason and Notes; Apply calls stock-adjustment API with delta and reason.
- When selecting “Set exact stock”, UI shows New Stock (number, min=0), hides Reason and Direction/Quantity fields; Apply calls update stock API with the exact quantity; Notes remain required.
- Preview panel updates live for both modes, showing Current, Change (delta with sign), and New Total. New Total turns red if negative (shouldn’t be possible in set mode due to min=0 but kept for guardrails).
- Form validation enforces required fields per mode. Apply is blocked for invalid input.

UX Details
- Mode: Select input labeled “Adjustment Mode”.
- For Set mode, New Stock field is prefilled with current stock.
- Notes always required.

Error Handling
- Show API errors via existing toast; map error details if present.

Security
- Existing admin token header usage is preserved.

[NEEDS CLARIFICATION: Should setting stock require a reason code for audit?] For now, we keep Notes required and rely on backend to create an adjustment audit entry on stock set.

