-- Fix ambiguous column reference in trg_prices_validate
DROP TRIGGER IF EXISTS trg_prices_validate_insupd ON prices;
DROP FUNCTION IF EXISTS trg_prices_validate();

CREATE OR REPLACE FUNCTION trg_prices_validate()
RETURNS trigger AS $$
DECLARE
  v_is_composite BOOLEAN;
BEGIN
  SELECT i.is_composite INTO v_is_composite FROM items i WHERE i.id = NEW.item_id;
  IF v_is_composite IS NULL THEN
    RAISE EXCEPTION 'Invalid item reference for price';
  END IF;
  IF v_is_composite = TRUE THEN
    RAISE EXCEPTION 'Cannot define prices for composite items';
  END IF;
  IF NEW.kind = 'Hourly' THEN
    RAISE EXCEPTION 'Hourly prices are not allowed on items (services only)';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_prices_validate_insupd
BEFORE INSERT OR UPDATE ON prices
FOR EACH ROW EXECUTE FUNCTION trg_prices_validate();

