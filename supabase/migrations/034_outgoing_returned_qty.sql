ALTER TABLE outgoing_stock
  ADD COLUMN IF NOT EXISTS returned_qty integer NOT NULL DEFAULT 0;
