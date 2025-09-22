-- Relax prices amount check to allow zero (non-negative)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'prices_amount_check'
  ) THEN
    ALTER TABLE prices DROP CONSTRAINT prices_amount_check;
  END IF;
END$$;

ALTER TABLE prices
  ADD CONSTRAINT prices_amount_check CHECK (amount >= 0);

