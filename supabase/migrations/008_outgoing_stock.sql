-- Allow manually-added incoming entries (no order_history required)
ALTER TABLE incoming_stock ALTER COLUMN order_history_id DROP NOT NULL;

-- Outgoing shipments
CREATE TABLE outgoing_stock (
  id BIGSERIAL PRIMARY KEY,
  product_id BIGINT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  product_name TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  scheduled_date DATE NOT NULL,
  note TEXT,
  shipped_at TIMESTAMPTZ
);

ALTER TABLE outgoing_stock DISABLE ROW LEVEL SECURITY;
