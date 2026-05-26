-- Add location tracking to lots (where the stock physically lives)
ALTER TABLE lots
  ADD COLUMN IF NOT EXISTS location_id  INTEGER REFERENCES locations(id)  ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS location_name TEXT,
  ADD COLUMN IF NOT EXISTS warehouse_id  INTEGER REFERENCES warehouses(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS warehouse_name TEXT;

-- Add optional location to outgoing_stock (manual pick-from-location)
ALTER TABLE outgoing_stock
  ADD COLUMN IF NOT EXISTS location_id  INTEGER REFERENCES locations(id)  ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS location_name TEXT;

-- Stock transfer history
CREATE TABLE stock_transfers (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users NOT NULL,
  lot_id INTEGER REFERENCES lots(id) ON DELETE SET NULL,
  product_id INTEGER REFERENCES products(id) NOT NULL,
  product_name TEXT NOT NULL,
  from_location_id  INTEGER REFERENCES locations(id) ON DELETE SET NULL,
  from_location_name TEXT,
  to_location_id    INTEGER REFERENCES locations(id) ON DELETE SET NULL,
  to_location_name  TEXT,
  quantity INTEGER NOT NULL,
  note TEXT,
  transferred_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE stock_transfers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_stock_transfers" ON stock_transfers FOR ALL
  USING (user_id = get_owner_id()) WITH CHECK (user_id = get_owner_id());
