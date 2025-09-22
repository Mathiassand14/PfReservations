-- Enforce order_lines constraints between line_type/kind/item
CREATE OR REPLACE FUNCTION trg_order_lines_validate()
RETURNS trigger AS $$
DECLARE
  is_composite BOOLEAN;
BEGIN
  IF NEW.line_type = 'Service' THEN
    IF NEW.kind <> 'Hourly' THEN
      RAISE EXCEPTION 'Service lines must be Hourly';
    END IF;
    IF NEW.item_id IS NOT NULL THEN
      RAISE EXCEPTION 'Service lines must not reference an item_id';
    END IF;
  ELSIF NEW.line_type = 'Equipment' THEN
    IF NEW.kind NOT IN ('Start','Daily') THEN
      RAISE EXCEPTION 'Equipment lines must be Start or Daily';
    END IF;
    IF NEW.item_id IS NULL THEN
      RAISE EXCEPTION 'Equipment lines must reference an item_id';
    END IF;
    SELECT is_composite INTO is_composite FROM items WHERE id = NEW.item_id;
    IF is_composite IS NULL THEN
      RAISE EXCEPTION 'Invalid item_id in order_lines';
    END IF;
    IF is_composite = TRUE THEN
      RAISE EXCEPTION 'Composite items cannot be added directly to orders';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_order_lines_validate_insupd ON order_lines;
CREATE TRIGGER trg_order_lines_validate_insupd
BEFORE INSERT OR UPDATE ON order_lines
FOR EACH ROW EXECUTE FUNCTION trg_order_lines_validate();

