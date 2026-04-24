-- Add optional unit price to products for order value calculation
ALTER TABLE products ADD COLUMN IF NOT EXISTS price NUMERIC(10, 2);
