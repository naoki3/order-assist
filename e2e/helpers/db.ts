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

/**
 * テスト用の在庫・ロットを直接 seed する。
 * 出荷フローのテストで「引当できる在庫がある」状態を作るために使う。
 */
export async function seedInventory(productId: number, warehouseId: number, qty: number) {
  const sb = adminClient();

  // lots に 1 件追加
  const { data: lot, error: lotErr } = await sb
    .from('lots')
    .insert({
      product_id: productId,
      warehouse_id: warehouseId,
      lot_number: `E2E-LOT-${Date.now()}`,
      quantity: qty,
      received_at: new Date().toISOString().split('T')[0],
    })
    .select()
    .single();
  if (lotErr) throw new Error(`seedInventory lot: ${lotErr.message}`);

  // inventory を upsert
  const { error: invErr } = await sb
    .from('inventory')
    .upsert(
      { product_id: productId, current_stock: qty, allocated_qty: 0 },
      { onConflict: 'product_id' }
    );
  if (invErr) throw new Error(`seedInventory inventory: ${invErr.message}`);

  return lot;
}
