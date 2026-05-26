-- Multi-tenant support: sub-users created by an admin share the admin's data

CREATE TABLE tenant_members (
  id SERIAL PRIMARY KEY,
  owner_id UUID REFERENCES auth.users NOT NULL,
  member_id UUID REFERENCES auth.users NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT tenant_members_unique UNIQUE (owner_id, member_id)
);
ALTER TABLE tenant_members ENABLE ROW LEVEL SECURITY;
-- Owner manages their members
CREATE POLICY "owners manage members" ON tenant_members
  FOR ALL USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
-- Members can read their own entry
CREATE POLICY "members read own entry" ON tenant_members
  FOR SELECT USING (member_id = auth.uid());

-- Returns the effective tenant owner UID for the current session.
-- If the caller is a sub-user, returns their owner's UID.
-- If the caller is an owner, returns their own UID.
-- Returns NULL when called without an authenticated session.
CREATE OR REPLACE FUNCTION get_owner_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN auth.uid() IS NULL THEN NULL
    ELSE COALESCE(
      (SELECT owner_id FROM tenant_members WHERE member_id = auth.uid()),
      auth.uid()
    )
  END;
$$;

-- ── Re-create all RLS policies to use get_owner_id() ──────────────────────

-- products
DROP POLICY IF EXISTS "own_products" ON products;
CREATE POLICY "own_products" ON products FOR ALL
  USING (user_id = get_owner_id()) WITH CHECK (user_id = get_owner_id());

-- sales
DROP POLICY IF EXISTS "own_sales" ON sales;
CREATE POLICY "own_sales" ON sales FOR ALL
  USING (user_id = get_owner_id()) WITH CHECK (user_id = get_owner_id());

-- inventory (linked through products, no user_id column)
DROP POLICY IF EXISTS "own_inventory" ON inventory;
CREATE POLICY "own_inventory" ON inventory FOR ALL
  USING (product_id IN (SELECT id FROM products WHERE user_id = get_owner_id()))
  WITH CHECK (product_id IN (SELECT id FROM products WHERE user_id = get_owner_id()));

-- order_history
DROP POLICY IF EXISTS "own_order_history" ON order_history;
CREATE POLICY "own_order_history" ON order_history FOR ALL
  USING (user_id = get_owner_id()) WITH CHECK (user_id = get_owner_id());

-- incoming_stock
DROP POLICY IF EXISTS "own_incoming_stock" ON incoming_stock;
CREATE POLICY "own_incoming_stock" ON incoming_stock FOR ALL
  USING (
    user_id = get_owner_id()
    OR order_history_id IN (SELECT id FROM order_history WHERE user_id = get_owner_id())
  )
  WITH CHECK (user_id = get_owner_id());

-- outgoing_stock
DROP POLICY IF EXISTS "own_outgoing_stock" ON outgoing_stock;
CREATE POLICY "own_outgoing_stock" ON outgoing_stock FOR ALL
  USING (user_id = get_owner_id()) WITH CHECK (user_id = get_owner_id());

-- lots
DROP POLICY IF EXISTS "own_lots" ON lots;
CREATE POLICY "own_lots" ON lots FOR ALL
  USING (user_id = get_owner_id()) WITH CHECK (user_id = get_owner_id());

-- sales_targets
DROP POLICY IF EXISTS "own_sales_targets" ON sales_targets;
CREATE POLICY "own_sales_targets" ON sales_targets FOR ALL
  USING (user_id = get_owner_id()) WITH CHECK (user_id = get_owner_id());

-- suppliers
DROP POLICY IF EXISTS "Users manage their own suppliers" ON suppliers;
CREATE POLICY "own_suppliers" ON suppliers FOR ALL
  USING (user_id = get_owner_id()) WITH CHECK (user_id = get_owner_id());

-- delivery_destinations
DROP POLICY IF EXISTS "Users manage their own destinations" ON delivery_destinations;
CREATE POLICY "own_destinations" ON delivery_destinations FOR ALL
  USING (user_id = get_owner_id()) WITH CHECK (user_id = get_owner_id());

-- carriers
DROP POLICY IF EXISTS "Users manage their own carriers" ON carriers;
CREATE POLICY "own_carriers" ON carriers FOR ALL
  USING (user_id = get_owner_id()) WITH CHECK (user_id = get_owner_id());

-- inventory_statuses
DROP POLICY IF EXISTS "Users manage their own inventory statuses" ON inventory_statuses;
CREATE POLICY "own_inventory_statuses" ON inventory_statuses FOR ALL
  USING (user_id = get_owner_id()) WITH CHECK (user_id = get_owner_id());

-- user_profiles
DROP POLICY IF EXISTS "Users manage their own user profiles" ON user_profiles;
CREATE POLICY "own_user_profiles" ON user_profiles FOR ALL
  USING (user_id = get_owner_id()) WITH CHECK (user_id = get_owner_id());

-- warehouses
DROP POLICY IF EXISTS "Users manage their own warehouses" ON warehouses;
CREATE POLICY "own_warehouses" ON warehouses FOR ALL
  USING (user_id = get_owner_id()) WITH CHECK (user_id = get_owner_id());

-- locations
DROP POLICY IF EXISTS "Users manage their own locations" ON locations;
CREATE POLICY "own_locations" ON locations FOR ALL
  USING (user_id = get_owner_id()) WITH CHECK (user_id = get_owner_id());
