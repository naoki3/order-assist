-- Add user_id to incoming_stock for direct (non-order) inserts
ALTER TABLE incoming_stock ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);

-- Update RLS policy to allow both order-linked rows and direct manual entries
DROP POLICY IF EXISTS "own_incoming_stock" ON incoming_stock;

CREATE POLICY "own_incoming_stock" ON incoming_stock FOR ALL
  USING (
    user_id = auth.uid()
    OR order_history_id IN (SELECT id FROM order_history WHERE user_id = auth.uid())
  );
