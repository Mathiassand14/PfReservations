-- Add items.type with constraints and backfill from is_composite

ALTER TABLE items
  ADD COLUMN IF NOT EXISTS type VARCHAR(16) NOT NULL DEFAULT 'Atomic';

ALTER TABLE items
  ADD CONSTRAINT items_type_check CHECK (type IN ('Atomic','Composite','Service'));

-- Backfill from legacy is_composite
UPDATE items SET type = 'Composite' WHERE is_composite = true;

-- Enforce quantity_on_hand by type
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'items_qty_by_type_check'
  ) THEN
    ALTER TABLE items
      ADD CONSTRAINT items_qty_by_type_check
      CHECK (
        (type IN ('Composite','Service') AND quantity_on_hand IS NULL)
        OR (type = 'Atomic' AND (quantity_on_hand IS NULL OR quantity_on_hand >= 0))
      );
  END IF;
END$$;

-- Optional: keep is_composite in sync for compatibility
CREATE OR REPLACE FUNCTION trg_items_sync_is_composite()
RETURNS trigger AS $$
BEGIN
  NEW.is_composite := (NEW.type = 'Composite');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_items_sync_is_composite_insupd ON items;
CREATE TRIGGER trg_items_sync_is_composite_insupd
BEFORE INSERT OR UPDATE ON items
FOR EACH ROW EXECUTE FUNCTION trg_items_sync_is_composite();

