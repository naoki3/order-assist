-- Sales targets table for monthly revenue goals
CREATE TABLE IF NOT EXISTS sales_targets (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  month VARCHAR(7) NOT NULL, -- YYYY-MM
  target_amount NUMERIC(12, 2) NOT NULL,
  UNIQUE(user_id, month)
);

ALTER TABLE sales_targets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_sales_targets" ON sales_targets FOR ALL USING (user_id = auth.uid());
