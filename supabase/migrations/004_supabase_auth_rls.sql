-- Add user_id columns linked to Supabase Auth users
ALTER TABLE products ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE order_history ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Enable RLS on all tables
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE incoming_stock ENABLE ROW LEVEL SECURITY;

-- Products: each user owns their own rows
CREATE POLICY "own_products" ON products FOR ALL USING (user_id = auth.uid());

-- Sales: each user owns their own rows
CREATE POLICY "own_sales" ON sales FOR ALL USING (user_id = auth.uid());

-- Inventory: accessible when the product belongs to the user
CREATE POLICY "own_inventory" ON inventory FOR ALL
  USING (product_id IN (SELECT id FROM products WHERE user_id = auth.uid()));

-- Order history: each user owns their own rows
CREATE POLICY "own_order_history" ON order_history FOR ALL USING (user_id = auth.uid());

-- Incoming stock: accessible when the parent order belongs to the user
CREATE POLICY "own_incoming_stock" ON incoming_stock FOR ALL
  USING (order_history_id IN (SELECT id FROM order_history WHERE user_id = auth.uid()));
