-- Drop legacy items quantity constraint based on is_composite
-- It conflicts with the newer items_qty_by_type_check that uses items.type
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'check_atomic_has_quantity'
  ) THEN
    ALTER TABLE items DROP CONSTRAINT check_atomic_has_quantity;
  END IF;
END$$;

