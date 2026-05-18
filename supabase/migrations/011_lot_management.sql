-- Lot management
CREATE TABLE IF NOT EXISTS lots (
  id BIGSERIAL PRIMARY KEY,
  lot_number TEXT NOT NULL,
  product_id BIGINT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  product_name TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 0,
  received_at DATE NOT NULL,
  expiry_date DATE,
  incoming_stock_id BIGINT REFERENCES incoming_stock(id) ON DELETE SET NULL,
  user_id UUID REFERENCES auth.users(id)
);

ALTER TABLE lots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own_lots" ON lots FOR ALL
  USING (user_id = auth.uid());

-- Add lot reference to outgoing shipments
ALTER TABLE outgoing_stock ADD COLUMN IF NOT EXISTS lot_id BIGINT REFERENCES lots(id) ON DELETE SET NULL;
ALTER TABLE outgoing_stock ADD COLUMN IF NOT EXISTS lot_number TEXT;
