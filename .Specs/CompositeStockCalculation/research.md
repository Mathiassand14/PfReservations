yesResearch

- Existing composite logic: `ItemComponentService` has `calculateCompositeAvailability(components)` and BOM utilities.
- Availability pipeline for orders already handles composites (`AvailabilityService.calculateCompositeAvailability`).
- Stock summary for items previously threw on composites; now extended.
- `StockMovementRepository.getCurrentStock` explicitly excluded composites; route now branches to service for composites.

