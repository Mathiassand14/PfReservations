-- Update item_components constraints to use items.type

-- Replace existing trigger to validate that parent is Composite and child is Atomic
DROP TRIGGER IF EXISTS trg_item_components_validate_insupd ON item_components;
DROP FUNCTION IF EXISTS trg_item_components_validate();

CREATE OR REPLACE FUNCTION trg_item_components_validate()
RETURNS trigger AS $$
DECLARE
  parent_type TEXT;
  child_type TEXT;
BEGIN
  SELECT type INTO parent_type FROM items WHERE id = NEW.parent_id;
  SELECT type INTO child_type FROM items WHERE id = NEW.child_id;

  IF parent_type IS NULL OR child_type IS NULL THEN
    RAISE EXCEPTION 'Invalid parent or child item reference';
  END IF;

  IF parent_type <> 'Composite' THEN
    RAISE EXCEPTION 'Parent item must be Composite';
  END IF;

  IF child_type <> 'Atomic' THEN
    RAISE EXCEPTION 'Child item must be Atomic (equipment only)';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_item_components_validate_insupd
BEFORE INSERT OR UPDATE ON item_components
FOR EACH ROW EXECUTE FUNCTION trg_item_components_validate();

