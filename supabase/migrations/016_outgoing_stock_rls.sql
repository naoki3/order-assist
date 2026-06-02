-- Add user_id to outgoing_stock and enable RLS
ALTER TABLE outgoing_stock ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);

ALTER TABLE outgoing_stock ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own_outgoing_stock" ON outgoing_stock FOR ALL
  USING (user_id = auth.uid());
