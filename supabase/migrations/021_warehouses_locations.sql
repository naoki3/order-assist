-- Warehouses
CREATE TABLE warehouses (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users NOT NULL,
  name TEXT NOT NULL,
  address TEXT,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE warehouses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage their own warehouses" ON warehouses
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
ALTER TABLE warehouses
  ADD CONSTRAINT warehouses_user_name_key UNIQUE (user_id, name);

-- Locations (each belongs to a warehouse)
CREATE TABLE locations (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users NOT NULL,
  warehouse_id INTEGER REFERENCES warehouses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE locations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage their own locations" ON locations
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
ALTER TABLE locations
  ADD CONSTRAINT locations_user_warehouse_name_key UNIQUE (user_id, warehouse_id, name);
