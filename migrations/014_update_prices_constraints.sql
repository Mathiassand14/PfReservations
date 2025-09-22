-- Update prices trigger constraints to enforce type-specific pricing

DROP TRIGGER IF EXISTS trg_prices_validate_insupd ON prices;
DROP FUNCTION IF EXISTS trg_prices_validate();

CREATE OR REPLACE FUNCTION trg_prices_validate()
RETURNS trigger AS $$
DECLARE
  v_type TEXT;
BEGIN
  SELECT i.type INTO v_type FROM items i WHERE i.id = NEW.item_id;
  IF v_type IS NULL THEN
    RAISE EXCEPTION 'Invalid item reference for price';
  END IF;

  -- No prices for Composite items
  IF v_type = 'Composite' THEN
    RAISE EXCEPTION 'Cannot define prices for composite items';
  END IF;

  -- Atomic: allow Start or Daily only
  IF v_type = 'Atomic' THEN
    IF NEW.kind NOT IN ('Start','Daily') THEN
      RAISE EXCEPTION 'Atomic item prices must be Start or Daily';
    END IF;
  END IF;

  -- Service: allow Hourly only
  IF v_type = 'Service' THEN
    IF NEW.kind <> 'Hourly' THEN
      RAISE EXCEPTION 'Service prices must be Hourly';
    END IF;
  END IF;

  IF NEW.amount < 0 THEN
    RAISE EXCEPTION 'Price amount must be non-negative';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_prices_validate_insupd
BEFORE INSERT OR UPDATE ON prices
FOR EACH ROW EXECUTE FUNCTION trg_prices_validate();

