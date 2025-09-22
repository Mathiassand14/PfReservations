Plan

Goals
- Add a selectable mode in the Adjust Stock modal to allow direct entry of the target stock quantity.

Steps
1) UI: Add “Adjustment Mode” select with two options (Delta, Set exact)
2) UI: Toggle fields — show Quantity + Direction + Reason for Delta; show New Stock for Set
3) Logic: Update preview calculator to support both modes
4) Apply: Call POST /stock-adjustment for Delta; PATCH /stock for Set exact
5) Validation: Enforce required fields per mode (Notes always required)
6) Docs: Quick manual test notes in quickstart

Notes
- Backend already supports PATCH /api/items/:id/stock and will create an audit movement; we’ll pass Notes.
- If future guidance requires a reason code for Set mode, add mapping to a default reason and record in plan history.

