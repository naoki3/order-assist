-- Allow specifying a lot number on incoming schedule entries
ALTER TABLE incoming_stock ADD COLUMN IF NOT EXISTS lot_number TEXT;
