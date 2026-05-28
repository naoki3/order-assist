/**
 * Direct Supabase admin access for test data setup/teardown.
 * Requires SUPABASE_SERVICE_ROLE_KEY in .env.test.local.
 */
import { createClient } from '@supabase/supabase-js';

function adminClient() {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export async function createTestProduct(name: string, price?: number) {
  const sb = adminClient();
  const { data, error } = await sb
    .from('products')
    .insert({ name, price: price ?? null })
    .select()
    .single();
  if (error) throw new Error(`createTestProduct: ${error.message}`);
  return data as { id: number; name: string };
}

export async function deleteTestProduct(id: number) {
  const sb = adminClient();
  await sb.from('products').delete().eq('id', id);
}

export async function createTestWarehouse(name: string) {
  const sb = adminClient();
  const { data, error } = await sb
    .from('warehouses')
    .insert({ name })
    .select()
    .single();
  if (error) throw new Error(`createTestWarehouse: ${error.message}`);
  return data as { id: number; name: string };
}

export async function deleteTestWarehouse(id: number) {
  const sb = adminClient();
  await sb.from('warehouses').delete().eq('id', id);
}

export async function createTestSupplier(name: string) {
  const sb = adminClient();
  const { data, error } = await sb
    .from('suppliers')
    .insert({ name })
    .select()
    .single();
  if (error) throw new Error(`createTestSupplier: ${error.message}`);
  return data as { id: number; name: string };
}

export async function deleteTestSupplier(id: number) {
  const sb = adminClient();
  await sb.from('suppliers').delete().eq('id', id);
}

export async function deleteTestReceiptsByWarehouse(warehouseId: number) {
  const sb = adminClient();
  await sb.from('receipts').delete().eq('warehouse_id', warehouseId);
}

export async function deleteTestShipmentsByWarehouse(warehouseId: number) {
  const sb = adminClient();
  await sb.from('shipments').delete().eq('warehouse_id', warehouseId);
}
