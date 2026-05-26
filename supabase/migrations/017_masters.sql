-- Suppliers
CREATE TABLE suppliers (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users NOT NULL,
  name TEXT NOT NULL,
  contact_name TEXT,
  phone TEXT,
  email TEXT,
  address TEXT,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage their own suppliers" ON suppliers
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Delivery destinations
CREATE TABLE delivery_destinations (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users NOT NULL,
  name TEXT NOT NULL,
  contact_name TEXT,
  phone TEXT,
  address TEXT,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE delivery_destinations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage their own destinations" ON delivery_destinations
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Carriers
CREATE TABLE carriers (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users NOT NULL,
  name TEXT NOT NULL,
  contact_name TEXT,
  phone TEXT,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE carriers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage their own carriers" ON carriers
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Inventory statuses
CREATE TABLE inventory_statuses (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users NOT NULL,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT 'slate',
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE inventory_statuses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage their own inventory statuses" ON inventory_statuses
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
