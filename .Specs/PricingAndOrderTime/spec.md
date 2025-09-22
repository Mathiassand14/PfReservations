sp# Customer Rebates, Services, and Order Time Windows — Product Requirements

## User Scenarios
- Admin imports CurrentItems.csv. Items and base prices (Start/Daily, Hourly for services) are created/updated. A single global “Internal” rebate percent is derived as the average discount observed across items that have both “(Ekstern, …)” and “(Intern, …)” prices; “Ekstern” is 0% rebate. A summary report shows derivation and row outcomes. SKUs never change; Vare# is stored only as a legacy reference.
- Staff creates an order (Draft) for a customer with a rebate group or explicit rebate percent. Totals calculate automatically on creation. Equipment lines (Start/Daily kinds) receive the customer’s rebate; Service lines (Hourly) do not. Inventory is reserved from setup to cleanup.
- Staff moves an order to Reserved. Totals auto‑recalculate and persist. Moving to Dispatched (replacement for “Checked Out”) does not auto‑recalculate; a Recalculate action is available.
- Staff adds a Service line for 2h05m. Billed time rounds up to the next 15 minutes (2h15m). Services never affect inventory or receive rebates.

## Functional Requirements
- Currency: DKK. Prices VAT‑exclusive.
- Item types (persisted on items):
  - Atomic Equipment: stock‑tracked; eligible for rebates; can have quantity_on_hand.
  - Composite Equipment: no direct price; sums components; not stock‑tracked; cannot be ordered directly.
  - Service: non‑stock; billed Hourly; never discounted; cannot be a component.
- Pricing kinds: Start (one‑time per line), Daily (per rental day), Hourly (Services only; billed in 15‑minute increments, rounded up).
- Composite items (bundles): have no direct price. Their line total is the sum of their component items’ prices according to component quantities and the same pricing rules (Start/Daily) and rebate policy. Components must be Equipment only; Services are not allowed as components.
- Customer rebates: either by rebate group or a per‑customer override (override takes precedence). Groups: Ekstern = 0%; Internal = single global percentage derived from CSV pairs (average percentage difference across Start/Daily pairs; exclude Hourly).
- Order time windows: capture setup_start (optional), order_start (required), order_end (required), cleanup_end (optional). Availability and the item “out” period run from min(setup_start, order_start) to max(order_end, cleanup_end). Pricing uses only [order_start, order_end].
- Daily threshold: If order window duration ≤ 24h, Daily = 0; if > 24h, Daily_count = ceil((duration − 24h)/24h). Start may still apply. Rebates apply to Equipment Start and Daily components only.
- Calculation behavior: totals stored at creation; auto‑calculate on Draft and Reserved; no auto‑calculate on Dispatched; explicit Recalculate action available. Manual line price overrides require a reason and are excluded from auto‑recalculation unless reset.
- Import behavior: idempotent; invalid rows reported with line numbers; names may include non‑English characters and are preserved as‑is.

## Data & Constraints
- Entities (conceptual): Item (name, type, legacy_code), Price (kind, amount), Customer (rebate_group, rebate_percent_override), Order (status, setup/order/cleanup times, stored totals), OrderLine (type, kind, qty/hours, unit price, override flag).
- Constraints: unique Price per item/kind; amount > 0; rebate 0–100%; Services never discounted and never reserve inventory; composite components must be Equipment only (no Service components).

## Acceptance Checklist
- 20h order window, Equipment Start=500, Daily=200 → total = 500 DKK (no Daily).
- 24h01m window → total = 500 + 1×200 = 700 DKK.
- 49h window → total = 500 + 2×200 = 900 DKK.
- Composite example: Bundle = 1×Mixer (Start=500, Daily=200) + 2×Monitor (Start=300, Daily=150). For a 26h order window and Internal rebate of 20%, total = [(500 + 1×200) + 2×(300 + 1×150)] × 0.8 = 1760 DKK.
- Service “Personaleløn” at 160 DKK/h for 2h05m → billed 2h15m; total = 360 DKK; no rebate; no inventory impact.
- Customer in Ekstern group (0%) sees no discounts; Internal group applies the single derived rebate percent on Equipment lines. Recalculate updates stored totals in Draft/Reserved; Dispatched requires manual action.
 - Availability: If setup_start is 4h before and cleanup_end 3h after the order window, the item is considered out/unavailable for that entire extended period; overlapping reservations are rejected.
