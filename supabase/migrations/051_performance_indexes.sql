-- Performance indexes for RLS filtering and common query patterns

-- receipts: RLS (user_id) + status + date filters
CREATE INDEX IF NOT EXISTS receipts_user_id_status_idx    ON receipts (user_id, status);
CREATE INDEX IF NOT EXISTS receipts_user_id_date_idx      ON receipts (user_id, expected_date);

-- receipt_lines: RLS (user_id) + status
CREATE INDEX IF NOT EXISTS receipt_lines_user_id_idx      ON receipt_lines (user_id);
CREATE INDEX IF NOT EXISTS receipt_lines_status_idx       ON receipt_lines (status);

-- shipments: RLS (user_id) + status + date filters
CREATE INDEX IF NOT EXISTS shipments_user_id_status_idx   ON shipments (user_id, status);
CREATE INDEX IF NOT EXISTS shipments_user_id_sched_idx    ON shipments (user_id, scheduled_date);
CREATE INDEX IF NOT EXISTS shipments_shipped_at_idx       ON shipments (shipped_at DESC) WHERE shipped_at IS NOT NULL;

-- shipment_lines: RLS (user_id) + status
CREATE INDEX IF NOT EXISTS shipment_lines_user_id_idx     ON shipment_lines (user_id);
CREATE INDEX IF NOT EXISTS shipment_lines_status_idx      ON shipment_lines (status);

-- products: RLS (user_id)
CREATE INDEX IF NOT EXISTS products_user_id_idx           ON products (user_id);

-- order_history: RLS (user_id)
CREATE INDEX IF NOT EXISTS order_history_user_id_idx      ON order_history (user_id);

-- sales: RLS (user_id)
CREATE INDEX IF NOT EXISTS sales_user_id_idx              ON sales (user_id);

-- lots: expiry_date for FEFO allocation and expiry alerts
-- (user_id is already the leading column of idx_lots_user_product_lot)
CREATE INDEX IF NOT EXISTS lots_expiry_date_idx           ON lots (expiry_date) WHERE expiry_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS lots_user_id_quantity_idx      ON lots (user_id, quantity) WHERE quantity > 0;

-- inventory_transactions: product/lot lookups and time-range queries
CREATE INDEX IF NOT EXISTS inv_tx_product_id_idx          ON inventory_transactions (product_id);
CREATE INDEX IF NOT EXISTS inv_tx_lot_id_idx              ON inventory_transactions (lot_id) WHERE lot_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS inv_tx_created_at_idx          ON inventory_transactions (created_at DESC);
