-- Link outgoing_stock to delivery destination and carrier at schedule time
ALTER TABLE outgoing_stock
  ADD COLUMN IF NOT EXISTS destination_id INTEGER REFERENCES delivery_destinations(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS destination_name TEXT,
  ADD COLUMN IF NOT EXISTS carrier_id INTEGER REFERENCES carriers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS carrier_name TEXT;
