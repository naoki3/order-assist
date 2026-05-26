-- Per-tenant configurable permissions for each role
-- sections: array of allowed section keys ('orders','incoming','inventory','shipping','sales','master','products')
CREATE TABLE role_permissions (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users NOT NULL,
  role TEXT NOT NULL,
  sections TEXT[] NOT NULL DEFAULT '{}',
  UNIQUE (user_id, role)
);
ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_role_permissions" ON role_permissions FOR ALL
  USING (user_id = get_owner_id()) WITH CHECK (user_id = get_owner_id());
