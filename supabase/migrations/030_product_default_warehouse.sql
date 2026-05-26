ALTER TABLE products
  ADD COLUMN IF NOT EXISTS default_warehouse_id INTEGER REFERENCES warehouses(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS default_warehouse_name TEXT;
