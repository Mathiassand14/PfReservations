-- Constraints and triggers for components and prices

-- Enforce: item_components parent must be composite; child must NOT be composite
CREATE OR REPLACE FUNCTION trg_item_components_validate()
RETURNS trigger AS $$
DECLARE
  parent_is_composite BOOLEAN;
  child_is_composite BOOLEAN;
BEGIN
  SELECT is_composite INTO parent_is_composite FROM items WHERE id = NEW.parent_id;
  SELECT is_composite INTO child_is_composite FROM items WHERE id = NEW.child_id;

  IF parent_is_composite IS NULL OR child_is_composite IS NULL THEN
    RAISE EXCEPTION 'Invalid parent or child item reference';
  END IF;

  IF parent_is_composite = FALSE THEN
    RAISE EXCEPTION 'Parent item must be composite';
  END IF;

  IF child_is_composite = TRUE THEN
    RAISE EXCEPTION 'Child item must not be composite (equipment only)';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_item_components_validate_insupd ON item_components;
CREATE TRIGGER trg_item_components_validate_insupd
BEFORE INSERT OR UPDATE ON item_components
FOR EACH ROW EXECUTE FUNCTION trg_item_components_validate();

-- Enforce: prices cannot be defined for composite items; disallow Hourly prices (services only)
CREATE OR REPLACE FUNCTION trg_prices_validate()
RETURNS trigger AS $$
DECLARE
  is_composite BOOLEAN;
BEGIN
  SELECT is_composite INTO is_composite FROM items WHERE id = NEW.item_id;
  IF is_composite IS NULL THEN
    RAISE EXCEPTION 'Invalid item reference for price';
  END IF;
  IF is_composite = TRUE THEN
    RAISE EXCEPTION 'Cannot define prices for composite items';
  END IF;
  IF NEW.kind = 'Hourly' THEN
    RAISE EXCEPTION 'Hourly prices are not allowed on items (services only)';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prices_validate_insupd ON prices;
CREATE TRIGGER trg_prices_validate_insupd
BEFORE INSERT OR UPDATE ON prices
FOR EACH ROW EXECUTE FUNCTION trg_prices_validate();
