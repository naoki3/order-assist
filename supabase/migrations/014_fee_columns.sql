ALTER TABLE products
  ADD COLUMN IF NOT EXISTS incoming_fee_per_piece NUMERIC,
  ADD COLUMN IF NOT EXISTS storage_fee_per_piece NUMERIC,
  ADD COLUMN IF NOT EXISTS outgoing_fee_per_piece NUMERIC;
