'use server';

import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { createClient } from './supabase';
import { createAdminClient } from './supabase-admin';
import { toLocalDateStr, DEFAULT_TZ } from './tz';

async function getLocalDate(): Promise<string> {
  const store = await cookies();
  const tz = store.get('tz')?.value ?? DEFAULT_TZ;
  return toLocalDateStr(tz);
}

// Returns the effective tenant owner UID for the current session.
// Sub-users get their admin's UID; owners get their own UID; null if unauthenticated.
async function getOwnerId(supabase: Awaited<ReturnType<typeof createClient>>): Promise<string | null> {
  const { data } = await supabase.rpc('get_owner_id');
  return (data as string | null) ?? null;
}

export type ActionResult = { error: string } | { success: string } | null;
export type SignupResult = { error: string } | { needsConfirmation: true } | null;

// ─── Order ───────────────────────────────────────────────────────────────────

export interface OrderItem {
  productId: number;
  productName: string;
  quantity: number;
  expectedDate: string;
}

export async function placeOrder(items: OrderItem[]): Promise<ActionResult> {
  const nonZero = items.filter((i) => i.quantity > 0);
  if (nonZero.length === 0) return { error: 'All order quantities are 0' };

  const supabase = await createClient();
  const ownerId = await getOwnerId(supabase);
  if (!ownerId) return { error: 'Not authenticated' };

  const { data: orderData, error } = await supabase
    .from('order_history')
    .insert({ created_at: new Date().toISOString(), items: JSON.stringify(nonZero), user_id: ownerId })
    .select('id')
    .single();

  if (error || !orderData) {
    return { error: `Failed to place order: ${error?.message ?? 'unknown error'}` };
  }

  const incomingRows = nonZero.map((item) => ({
    order_history_id: orderData.id,
    product_id: item.productId,
    product_name: item.productName,
    quantity: item.quantity,
    expected_date: item.expectedDate,
  }));

  const { error: insertError } = await supabase.from('incoming_stock').insert(incomingRows);
  if (insertError) {
    return { error: `Order placed but failed to register incoming stock: ${insertError.message}` };
  }

  revalidatePath('/history');
  revalidatePath('/incoming');
  return { success: 'ok' };
}

export async function receiveBulkIncoming(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  let ids: number[];
  try { ids = JSON.parse(String(formData.get('ids') ?? '[]')); } catch { return { error: 'Invalid input' }; }
  if (ids.length === 0) return { success: 'ok' };

  const supabase = await createClient();
  const ownerId = await getOwnerId(supabase);
  if (!ownerId) return { error: 'Not authenticated' };

  const locationId = Number(formData.get('location_id')) || null;
  if (!locationId) return { error: 'ロケーションは必須です' };

  const { data: items, error: fetchError } = await supabase
    .from('incoming_stock')
    .select('id, product_id, product_name, quantity, lot_number, expiry_date, warehouse_id')
    .in('id', ids)
    .is('received_at', null);
  if (fetchError || !items || items.length === 0) return { error: 'Items not found' };

  // Resolve location/warehouse names once
  const { data: loc } = await supabase.from('locations').select('name, warehouse_id').eq('id', locationId).single();
  const locationName = loc?.name ?? null;
  const bulkWarehouseId = loc?.warehouse_id ?? null;
  let bulkWarehouseName: string | null = null;
  if (bulkWarehouseId) {
    const { data: w } = await supabase.from('warehouses').select('name').eq('id', bulkWarehouseId).single();
    bulkWarehouseName = w?.name ?? null;
  }

  const now = new Date();
  const localToday = await getLocalDate();
  const todayStr = localToday.replace(/-/g, '');
  const productIds = [...new Set(items.map((i) => i.product_id))];

  const { data: products } = await supabase
    .from('products').select('id, expiry_type').in('id', productIds);
  const expiryTypeMap = Object.fromEntries((products ?? []).map((p) => [p.id, p.expiry_type]));
  const missingExpiry = items.filter((item) => {
    const et = expiryTypeMap[item.product_id];
    return et && et !== 'none' && !item.expiry_date;
  });
  if (missingExpiry.length > 0) {
    return { error: `賞味期限未入力の商品があります: ${missingExpiry.map((i) => i.product_name).join(', ')}` };
  }

  const { data: inventories } = await supabase
    .from('inventory').select('product_id, current_stock').in('product_id', productIds);
  const stockMap: Record<number, number> = {};
  for (const inv of inventories ?? []) stockMap[inv.product_id] = inv.current_stock;

  const delta: Record<number, number> = {};
  for (const item of items) delta[item.product_id] = (delta[item.product_id] ?? 0) + item.quantity;

  const { error: markError } = await supabase
    .from('incoming_stock').update({ received_at: now.toISOString() }).in('id', ids);
  if (markError) return { error: `Failed to mark received: ${markError.message}` };

  for (const item of items) {
    const expiryDate: string | null = item.expiry_date ?? null;
    const lotNumber = item.lot_number ?? `${todayStr}-${item.id}`;
    await supabase.from('incoming_stock')
      .update({ lot_number: lotNumber, expiry_date: expiryDate }).eq('id', item.id);
    await supabase.from('lots').insert({
      lot_number: lotNumber, product_id: item.product_id, product_name: item.product_name,
      quantity: item.quantity, received_at: localToday,
      expiry_date: expiryDate, incoming_stock_id: item.id, user_id: ownerId,
      location_id: locationId, location_name: locationName,
      warehouse_id: bulkWarehouseId, warehouse_name: bulkWarehouseName,
    });
  }

  for (const [pidStr, qty] of Object.entries(delta)) {
    const pid = Number(pidStr);
    const { error: invError } = await supabase.from('inventory').upsert({
      product_id: pid, current_stock: (stockMap[pid] ?? 0) + qty,
      updated_at: localToday,
    });
    if (invError) return { error: `Failed to update inventory: ${invError.message}` };
  }

  revalidatePath('/incoming');
  revalidatePath('/inventory');
  revalidatePath('/');
  revalidatePath('/products');
  return { success: 'ok' };
}

export async function confirmBulkShipment(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  let ids: number[];
  try { ids = JSON.parse(String(formData.get('ids') ?? '[]')); } catch { return { error: 'Invalid input' }; }
  if (ids.length === 0) return { success: 'ok' };

  const supabase = await createClient();
  const { data: items, error: fetchError } = await supabase
    .from('outgoing_stock').select('id, product_id, quantity, lot_id')
    .in('id', ids).is('shipped_at', null);
  if (fetchError || !items || items.length === 0) return { error: 'Items not found' };

  const now = new Date();
  const localToday = await getLocalDate();
  const productIds = [...new Set(items.map((i) => i.product_id))];
  const { data: inventories } = await supabase
    .from('inventory').select('product_id, current_stock').in('product_id', productIds);
  const stockMap: Record<number, number> = {};
  for (const inv of inventories ?? []) stockMap[inv.product_id] = inv.current_stock;

  const delta: Record<number, number> = {};
  for (const item of items) delta[item.product_id] = (delta[item.product_id] ?? 0) + item.quantity;

  for (const [pidStr, qty] of Object.entries(delta)) {
    const pid = Number(pidStr);
    if ((stockMap[pid] ?? 0) < qty)
      return { error: `在庫不足: 商品ID ${pid} の現在庫 ${stockMap[pid] ?? 0} 個、出荷予定 ${qty} 個` };
  }

  for (const item of items) {
    if (item.lot_id) {
      const { data: lot } = await supabase.from('lots').select('quantity').eq('id', item.lot_id).single();
      const { data: reserved } = await supabase
        .from('outgoing_stock').select('quantity').eq('lot_id', item.lot_id).is('shipped_at', null).neq('id', item.id);
      const reservedQty = (reserved ?? []).reduce((s: number, r: { quantity: number }) => s + r.quantity, 0);
      const available = (lot?.quantity ?? 0) - reservedQty;
      if (available < item.quantity) {
        return { error: `ロット在庫不足 (ロットID:${item.lot_id}): 引当可能 ${available} 個、出荷予定 ${item.quantity} 個` };
      }
    }
  }

  const { error: markError } = await supabase
    .from('outgoing_stock').update({ shipped_at: now.toISOString() }).in('id', ids);
  if (markError) return { error: `Failed to confirm shipment: ${markError.message}` };

  for (const [pidStr, qty] of Object.entries(delta)) {
    const pid = Number(pidStr);
    const { error: invError } = await supabase.from('inventory').upsert({
      product_id: pid, current_stock: (stockMap[pid] ?? 0) - qty,
      updated_at: localToday,
    });
    if (invError) return { error: `Failed to update inventory: ${invError.message}` };
  }

  for (const item of items) {
    if (item.lot_id) {
      const { data: lot } = await supabase.from('lots').select('quantity').eq('id', item.lot_id).single();
      if (lot) await supabase.from('lots')
        .update({ quantity: Math.max(0, lot.quantity - item.quantity) }).eq('id', item.lot_id);
    } else {
      let bq = supabase
        .from('lots').select('id, quantity, lot_number')
        .eq('product_id', item.product_id).gt('quantity', 0);
      if ((item as { location_id?: number | null }).location_id) {
        bq = bq.eq('location_id', (item as { location_id?: number | null }).location_id!);
      }
      const { data: fifoLots } = await bq
        .order('expiry_date', { ascending: true, nullsFirst: false })
        .order('location_id', { ascending: true, nullsFirst: false })
        .order('lot_number', { ascending: true });
      let remaining = item.quantity;
      let firstLotId: number | null = null;
      let firstLotNumber: string | null = null;
      for (const lot of (fifoLots ?? [])) {
        if (remaining <= 0) break;
        if (firstLotId === null) { firstLotId = lot.id; firstLotNumber = lot.lot_number; }
        const take = Math.min(lot.quantity, remaining);
        await supabase.from('lots').update({ quantity: lot.quantity - take }).eq('id', lot.id);
        remaining -= take;
      }
      if (firstLotId !== null) {
        await supabase.from('outgoing_stock').update({ lot_id: firstLotId, lot_number: firstLotNumber }).eq('id', item.id);
      }
    }
  }

  revalidatePath('/shipping/confirm');
  revalidatePath('/shipping/schedule');
  revalidatePath('/inventory');
  return { success: 'ok' };
}

export async function updateIncomingSchedule(formData: FormData): Promise<ActionResult> {
  const id = Number(formData.get('id'));
  const lotNumber = String(formData.get('lot_number') ?? '').trim() || null;
  const expiryDate = String(formData.get('expiry_date') ?? '').trim() || null;

  const supabase = await createClient();
  if (!await getOwnerId(supabase)) return { error: 'Not authenticated' };

  const { error } = await supabase
    .from('incoming_stock')
    .update({ lot_number: lotNumber, expiry_date: expiryDate })
    .eq('id', id)
    .is('received_at', null);

  if (error) return { error: `Failed to update: ${error.message}` };
  revalidatePath('/incoming');
  return { success: 'ok' };
}

export async function receiveIncoming(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const id = Number(formData.get('id'));
  const formLot = String(formData.get('lot_number') ?? '').trim();
  const formExpiry = String(formData.get('expiry_date') ?? '').trim() || null;
  const locationIdRaw = formData.get('location_id');
  const location_id = locationIdRaw && String(locationIdRaw).trim() !== '' ? Number(locationIdRaw) : null;
  const location_name = (formData.get('location_name') as string | null) || null;
  const supabase = await createClient();
  const ownerId = await getOwnerId(supabase);
  if (!ownerId) return { error: 'Not authenticated' };

  const { data: incoming, error: fetchError } = await supabase
    .from('incoming_stock')
    .select('product_id, product_name, quantity, lot_number, warehouse_id')
    .eq('id', id)
    .single();

  if (fetchError || !incoming) {
    return { error: `Item not found: ${fetchError?.message ?? 'unknown error'}` };
  }

  const { data: product } = await supabase
    .from('products').select('expiry_type').eq('id', incoming.product_id).single();
  const expiryRequired = !!(product?.expiry_type && product.expiry_type !== 'none');
  if (expiryRequired && !formExpiry) return { error: '賞味期限は必須です' };

  const locationId = Number(formData.get('location_id')) || null;
  if (!locationId) return { error: 'ロケーションは必須です' };

  const localToday = await getLocalDate();
  const todayStr = localToday.replace(/-/g, '');
  const lotNumber = formLot || incoming.lot_number || `${todayStr}-${id}`;
  const expiryDate: string | null = formExpiry;

  // Resolve location and warehouse names
  const { data: loc } = await supabase.from('locations').select('name, warehouse_id').eq('id', locationId).single();
  const locationName = loc?.name ?? null;
  const warehouseId = (incoming as { warehouse_id?: number | null }).warehouse_id ?? loc?.warehouse_id ?? null;
  let warehouseName: string | null = null;
  if (warehouseId) {
    const { data: w } = await supabase.from('warehouses').select('name').eq('id', warehouseId).single();
    warehouseName = w?.name ?? null;
  }

  const { error: updateError } = await supabase
    .from('incoming_stock')
    .update({ received_at: new Date().toISOString(), expiry_date: expiryDate, lot_number: lotNumber, location_id, location_name })
    .eq('id', id);

  if (updateError) return { error: `Failed to mark as received: ${updateError.message}` };

  const { data: inv } = await supabase
    .from('inventory')
    .select('current_stock')
    .eq('product_id', incoming.product_id)
    .single();

  const { error: upsertError } = await supabase.from('inventory').upsert({
    product_id: incoming.product_id,
    current_stock: (inv?.current_stock ?? 0) + incoming.quantity,
    updated_at: localToday,
  });

  if (upsertError) return { error: `Failed to update inventory: ${upsertError.message}` };
  await supabase.from('lots').insert({
    lot_number: lotNumber,
    product_id: incoming.product_id,
    product_name: incoming.product_name,
    quantity: incoming.quantity,
    received_at: localToday,
    expiry_date: expiryDate,
    incoming_stock_id: id,
    user_id: ownerId,
    location_id: locationId,
    location_name: locationName,
    warehouse_id: warehouseId,
    warehouse_name: warehouseName,
  });

  revalidatePath('/incoming');
  revalidatePath('/inventory');
  revalidatePath('/');
  revalidatePath('/products');
  return { success: 'ok' };
}

// ─── Products ────────────────────────────────────────────────────────────────

export async function addProduct(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const name = (formData.get('name') as string).trim();
  const leadTime = Number(formData.get('lead_time_days'));
  const safetyStock = Number(formData.get('safety_stock_days'));
  const priceRaw = formData.get('price');
  const price = priceRaw && String(priceRaw).trim() !== '' ? Number(priceRaw) : null;
  const shelfLifeRaw = formData.get('shelf_life_days');
  const shelf_life_days = shelfLifeRaw && String(shelfLifeRaw).trim() !== '' ? Number(shelfLifeRaw) : null;
  const expiry_type = (formData.get('expiry_type') as string) || null;
  const piecesPerBallRaw = formData.get('pieces_per_ball');
  const pieces_per_ball = piecesPerBallRaw && String(piecesPerBallRaw).trim() !== '' ? Number(piecesPerBallRaw) : null;
  const ballsPerCaseRaw = formData.get('balls_per_case');
  const balls_per_case = ballsPerCaseRaw && String(ballsPerCaseRaw).trim() !== '' ? Number(ballsPerCaseRaw) : null;
  const casesPerPalletRaw = formData.get('cases_per_pallet');
  const cases_per_pallet = casesPerPalletRaw && String(casesPerPalletRaw).trim() !== '' ? Number(casesPerPalletRaw) : null;
  const incomingFeeRaw = formData.get('incoming_fee_per_piece');
  const incoming_fee_per_piece = incomingFeeRaw && String(incomingFeeRaw).trim() !== '' ? Number(incomingFeeRaw) : null;
  const storageFeeRaw = formData.get('storage_fee_per_piece');
  const storage_fee_per_piece = storageFeeRaw && String(storageFeeRaw).trim() !== '' ? Number(storageFeeRaw) : null;
  const outgoingFeeRaw = formData.get('outgoing_fee_per_piece');
  const outgoing_fee_per_piece = outgoingFeeRaw && String(outgoingFeeRaw).trim() !== '' ? Number(outgoingFeeRaw) : null;
  const defaultWarehouseIdRaw = formData.get('default_warehouse_id');
  const default_warehouse_id = defaultWarehouseIdRaw && String(defaultWarehouseIdRaw).trim() !== '' ? Number(defaultWarehouseIdRaw) : null;
  const default_warehouse_name = (formData.get('default_warehouse_name') as string | null) || null;

  if (!name || leadTime < 1 || safetyStock < 1) return { error: 'Invalid input values' };
  if (price !== null && (isNaN(price) || price < 0)) return { error: 'Invalid price value' };

  const supabase = await createClient();
  const ownerId = await getOwnerId(supabase);
  if (!ownerId) return { error: 'Not authenticated' };

  const { data: product, error } = await supabase
    .from('products')
    .insert({ name, lead_time_days: leadTime, safety_stock_days: safetyStock, price, shelf_life_days, expiry_type, pieces_per_ball, balls_per_case, cases_per_pallet, incoming_fee_per_piece, storage_fee_per_piece, outgoing_fee_per_piece, default_warehouse_id, default_warehouse_name, user_id: ownerId })
    .select('id')
    .single();

  if (error || !product) {
    return { error: `Failed to add product: ${error?.message ?? 'unknown error'}` };
  }

  const localToday = await getLocalDate();
  const { error: invError } = await supabase.from('inventory').upsert({
    product_id: product.id,
    current_stock: 0,
    updated_at: localToday,
  });

  if (invError) {
    return { error: `Product added but failed to initialize inventory: ${invError.message}` };
  }

  revalidatePath('/products');
  revalidatePath('/');
  return { success: 'ok' };
}

export async function updateProduct(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const id = Number(formData.get('id'));
  const name = (formData.get('name') as string).trim();
  const leadTime = Number(formData.get('lead_time_days'));
  const safetyStock = Number(formData.get('safety_stock_days'));
  const priceRaw = formData.get('price');
  const price = priceRaw && String(priceRaw).trim() !== '' ? Number(priceRaw) : null;
  const shelfLifeRaw = formData.get('shelf_life_days');
  const shelf_life_days = shelfLifeRaw && String(shelfLifeRaw).trim() !== '' ? Number(shelfLifeRaw) : null;
  const expiry_type = (formData.get('expiry_type') as string) || null;
  const piecesPerBallRaw = formData.get('pieces_per_ball');
  const pieces_per_ball = piecesPerBallRaw && String(piecesPerBallRaw).trim() !== '' ? Number(piecesPerBallRaw) : null;
  const ballsPerCaseRaw = formData.get('balls_per_case');
  const balls_per_case = ballsPerCaseRaw && String(ballsPerCaseRaw).trim() !== '' ? Number(ballsPerCaseRaw) : null;
  const casesPerPalletRaw = formData.get('cases_per_pallet');
  const cases_per_pallet = casesPerPalletRaw && String(casesPerPalletRaw).trim() !== '' ? Number(casesPerPalletRaw) : null;
  const incomingFeeRaw2 = formData.get('incoming_fee_per_piece');
  const incoming_fee_per_piece = incomingFeeRaw2 && String(incomingFeeRaw2).trim() !== '' ? Number(incomingFeeRaw2) : null;
  const storageFeeRaw2 = formData.get('storage_fee_per_piece');
  const storage_fee_per_piece = storageFeeRaw2 && String(storageFeeRaw2).trim() !== '' ? Number(storageFeeRaw2) : null;
  const outgoingFeeRaw2 = formData.get('outgoing_fee_per_piece');
  const outgoing_fee_per_piece = outgoingFeeRaw2 && String(outgoingFeeRaw2).trim() !== '' ? Number(outgoingFeeRaw2) : null;
  const defaultWarehouseIdRaw2 = formData.get('default_warehouse_id');
  const default_warehouse_id = defaultWarehouseIdRaw2 && String(defaultWarehouseIdRaw2).trim() !== '' ? Number(defaultWarehouseIdRaw2) : null;
  const default_warehouse_name = (formData.get('default_warehouse_name') as string | null) || null;

  if (!name || leadTime < 1 || safetyStock < 1) return { error: 'Invalid input values' };
  if (price !== null && (isNaN(price) || price < 0)) return { error: 'Invalid price value' };

  const supabase = await createClient();
  const { error } = await supabase
    .from('products')
    .update({ name, lead_time_days: leadTime, safety_stock_days: safetyStock, price, shelf_life_days, expiry_type, pieces_per_ball, balls_per_case, cases_per_pallet, incoming_fee_per_piece, storage_fee_per_piece, outgoing_fee_per_piece, default_warehouse_id, default_warehouse_name })
    .eq('id', id);

  if (error) return { error: `Failed to update product: ${error.message}` };

  revalidatePath('/products');
  revalidatePath('/products/[id]', 'page');
  revalidatePath('/');
  return { success: 'ok' };
}

export async function deleteProduct(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const id = Number(formData.get('id'));
  const supabase = await createClient();

  const { error } = await supabase.from('products').delete().eq('id', id);

  if (error) return { error: `Failed to delete product: ${error.message}` };

  revalidatePath('/products');
  revalidatePath('/');
  return { success: 'ok' };
}

// ─── Inventory ────────────────────────────────────────────────────────────────

export async function updateStock(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const productId = Number(formData.get('product_id'));
  const stock = Number(formData.get('current_stock'));
  const supabase = await createClient();

  const { data: pending } = await supabase
    .from('outgoing_stock')
    .select('quantity')
    .eq('product_id', productId)
    .is('shipped_at', null);

  const reserved = (pending ?? []).reduce((s, r) => s + r.quantity, 0);
  if (stock < reserved) {
    return { error: `出荷予定で ${reserved} 個が確保されているため、${reserved} 個未満には設定できません` };
  }

  const localToday = await getLocalDate();
  const { error } = await supabase.from('inventory').upsert({
    product_id: productId,
    current_stock: stock,
    updated_at: localToday,
  });

  if (error) return { error: `Failed to update stock: ${error.message}` };

  revalidatePath('/');
  revalidatePath('/products');
  revalidatePath('/inventory');
  revalidatePath('/inventory/[id]', 'page');
  return { success: 'ok' };
}

// ─── Sales ───────────────────────────────────────────────────────────────────

export async function upsertProductSales(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const productId = Number(formData.get('product_id'));
  const dates = formData.getAll('date') as string[];
  const quantities = formData.getAll('quantity').map(Number);

  if (dates.length === 0) return { error: 'No dates provided' };

  const supabase = await createClient();
  const ownerId = await getOwnerId(supabase);
  if (!ownerId) return { error: 'Not authenticated' };

  const rows = dates.map((date, i) => ({
    product_id: productId,
    date,
    quantity: quantities[i] ?? 0,
    user_id: ownerId,
  }));

  if (rows.some((r) => isNaN(r.quantity) || r.quantity < 0)) {
    return { error: 'Invalid quantity value' };
  }

  const { error } = await supabase
    .from('sales')
    .upsert(rows, { onConflict: 'product_id,date' });

  if (error) return { error: `Failed to save sales: ${error.message}` };

  revalidatePath('/sales');
  revalidatePath('/');
  return { success: 'ok' };
}

// ─── CSV Import ───────────────────────────────────────────────────────────────

export interface CsvImportResult {
  imported: number;
  skipped: string[];
  error?: string;
}

export async function importSalesCsv(
  _prev: CsvImportResult | null,
  formData: FormData
): Promise<CsvImportResult> {
  const file = formData.get('file') as File | null;
  if (!file || file.size === 0) return { imported: 0, skipped: [], error: 'No file provided' };

  const supabase = await createClient();
  const ownerId = await getOwnerId(supabase);
  if (!ownerId) return { imported: 0, skipped: [], error: 'Not authenticated' };

  const text = await file.text();
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim().split('\n');
  if (lines.length === 0) return { imported: 0, skipped: [], error: 'File is empty' };

  const firstLine = lines[0].toLowerCase();
  const dataLines = firstLine.startsWith('date') ? lines.slice(1) : lines;

  const { data: products } = await supabase.from('products').select('id, name');
  const productMap = new Map(
    (products ?? []).map((p) => [p.name.toLowerCase().trim(), p.id])
  );

  const rows: { product_id: number; date: string; quantity: number; user_id: string }[] = [];
  const skipped: string[] = [];

  for (const line of dataLines) {
    if (!line.trim()) continue;
    const parts = line.split(',');
    if (parts.length < 3) { skipped.push(line.trim()); continue; }
    const [rawDate, rawName, rawQty] = parts.map((s) => s.trim().replace(/^"|"$/g, ''));
    const quantity = parseInt(rawQty, 10);
    if (!rawDate || !rawName || isNaN(quantity) || quantity < 0) { skipped.push(line.trim()); continue; }
    const productId = productMap.get(rawName.toLowerCase());
    if (!productId) { skipped.push(`Unknown product: ${rawName}`); continue; }
    rows.push({ product_id: productId, date: rawDate, quantity, user_id: ownerId });
  }

  if (rows.length === 0) return { imported: 0, skipped, error: 'No valid rows found' };

  const { error } = await supabase.from('sales').upsert(rows, { onConflict: 'product_id,date' });
  if (error) return { imported: 0, skipped, error: `Failed to import: ${error.message}` };

  revalidatePath('/sales');
  revalidatePath('/');
  return { imported: rows.length, skipped };
}

// ─── Incoming Schedule ────────────────────────────────────────────────────────

export async function addIncomingSchedule(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const productId = Number(formData.get('product_id'));
  const quantity = Number(formData.get('quantity'));
  const expectedDate = String(formData.get('expected_date') ?? '').trim();

  if (!productId || isNaN(quantity) || quantity < 1 || !expectedDate) {
    return { error: 'Invalid input values' };
  }

  const supabase = await createClient();
  const ownerId = await getOwnerId(supabase);
  if (!ownerId) return { error: 'Not authenticated' };

  const { data: product } = await supabase
    .from('products')
    .select('name')
    .eq('id', productId)
    .single();

  if (!product) return { error: 'Product not found' };

  const lotNumber = String(formData.get('lot_number') ?? '').trim() || null;
  const supplierId = Number(formData.get('supplier_id')) || null;
  const warehouseId = Number(formData.get('warehouse_id')) || null;

  if (!warehouseId) return { error: '倉庫は必須です' };

  let supplierName: string | null = null;
  let warehouseName: string | null = null;
  if (supplierId) {
    const { data: s } = await supabase.from('suppliers').select('name').eq('id', supplierId).single();
    supplierName = s?.name ?? null;
  }
  if (warehouseId) {
    const { data: w } = await supabase.from('warehouses').select('name').eq('id', warehouseId).single();
    warehouseName = w?.name ?? null;
  }

  const { error } = await supabase.from('incoming_stock').insert({
    product_id: productId,
    product_name: product.name,
    quantity,
    expected_date: expectedDate,
    lot_number: lotNumber,
    user_id: ownerId,
    supplier_id: supplierId,
    supplier_name: supplierName,
    warehouse_id: warehouseId,
    warehouse_name: warehouseName,
  });

  if (error) return { error: `Failed to add schedule: ${error.message}` };

  revalidatePath('/incoming');
  revalidatePath('/incoming/schedule');
  revalidatePath('/dashboard');
  return { success: 'ok' };
}

export type ItemAddResult = { error: string } | { success: 'ok'; newId: number };

export async function addIncomingItem(formData: FormData): Promise<ItemAddResult> {
  const productId = Number(formData.get('product_id'));
  const quantity = Number(formData.get('quantity'));
  const expectedDate = String(formData.get('expected_date') ?? '').trim();
  const lotNumber = String(formData.get('lot_number') ?? '').trim() || null;
  const expiryDate = String(formData.get('expiry_date') ?? '').trim() || null;
  const supplierId = Number(formData.get('supplier_id')) || null;
  const warehouseId = Number(formData.get('warehouse_id')) || null;

  if (!productId || isNaN(quantity) || quantity < 1 || !expectedDate) {
    return { error: '入力値が不正です' };
  }

  const supabase = await createClient();
  const ownerId = await getOwnerId(supabase);
  if (!ownerId) return { error: 'Not authenticated' };

  const { data: product } = await supabase
    .from('products').select('name').eq('id', productId).single();
  if (!product) return { error: '商品が見つかりません' };

  let supplierName: string | null = null;
  let warehouseName: string | null = null;
  if (supplierId) {
    const { data: s } = await supabase.from('suppliers').select('name').eq('id', supplierId).single();
    supplierName = s?.name ?? null;
  }
  if (warehouseId) {
    const { data: w } = await supabase.from('warehouses').select('name').eq('id', warehouseId).single();
    warehouseName = w?.name ?? null;
  }

  const { data, error } = await supabase
    .from('incoming_stock')
    .insert({ product_id: productId, product_name: product.name, quantity, expected_date: expectedDate, lot_number: lotNumber, expiry_date: expiryDate, user_id: ownerId, supplier_id: supplierId, supplier_name: supplierName, warehouse_id: warehouseId, warehouse_name: warehouseName })
    .select('id')
    .single();

  if (error || !data) return { error: `追加失敗: ${error?.message}` };

  revalidatePath('/incoming');
  revalidatePath('/incoming/schedule');
  revalidatePath('/dashboard');
  return { success: 'ok', newId: data.id };
}

export async function addOutgoingItem(formData: FormData): Promise<ItemAddResult> {
  const productId = Number(formData.get('product_id'));
  const quantity = Number(formData.get('quantity'));
  const scheduledDate = String(formData.get('scheduled_date') ?? '').trim();
  const note = String(formData.get('note') ?? '').trim() || null;
  const lotIdRaw = formData.get('lot_id');
  const lotId = lotIdRaw && String(lotIdRaw).trim() ? Number(lotIdRaw) : null;
  const lotNumber = lotId ? String(formData.get('lot_number') ?? '').trim() || null : null;

  if (!productId || isNaN(quantity) || quantity < 1 || !scheduledDate) {
    return { error: '入力値が不正です' };
  }

  const supabase = await createClient();
  const ownerId = await getOwnerId(supabase);
  if (!ownerId) return { error: 'Not authenticated' };

  const { data: product } = await supabase
    .from('products').select('name').eq('id', productId).single();
  if (!product) return { error: '商品が見つかりません' };

  if (lotId) {
    const { data: lot } = await supabase.from('lots').select('quantity').eq('id', lotId).single();
    const { data: reserved } = await supabase
      .from('outgoing_stock').select('quantity').eq('lot_id', lotId).is('shipped_at', null);
    const reservedQty = (reserved ?? []).reduce((s, r) => s + r.quantity, 0);
    const available = (lot?.quantity ?? 0) - reservedQty;
    if (quantity > available) {
      return { error: `ロット在庫不足: 引当可能 ${available} 個` };
    }
  }

  const destinationId = Number(formData.get('destination_id')) || null;
  const carrierId = Number(formData.get('carrier_id')) || null;
  const locationId = Number(formData.get('location_id')) || null;
  const warehouseId = Number(formData.get('warehouse_id')) || null;
  let destinationName: string | null = null;
  let carrierName: string | null = null;
  let locationName: string | null = null;
  let warehouseName: string | null = null;
  if (destinationId) {
    const { data: d } = await supabase.from('delivery_destinations').select('name').eq('id', destinationId).single();
    destinationName = d?.name ?? null;
  }
  if (carrierId) {
    const { data: c } = await supabase.from('carriers').select('name').eq('id', carrierId).single();
    carrierName = c?.name ?? null;
  }
  if (locationId) {
    const { data: loc } = await supabase.from('locations').select('name').eq('id', locationId).single();
    locationName = loc?.name ?? null;
  }
  if (warehouseId) {
    const { data: w } = await supabase.from('warehouses').select('name').eq('id', warehouseId).single();
    warehouseName = w?.name ?? null;
  }

  const { data, error } = await supabase
    .from('outgoing_stock')
    .insert({ product_id: productId, product_name: product.name, quantity, scheduled_date: scheduledDate, note, lot_id: lotId, lot_number: lotNumber, user_id: ownerId, destination_id: destinationId, destination_name: destinationName, carrier_id: carrierId, carrier_name: carrierName, location_id: locationId, location_name: locationName, warehouse_id: warehouseId, warehouse_name: warehouseName })
    .select('id')
    .single();

  if (error || !data) return { error: `追加失敗: ${error?.message}` };

  revalidatePath('/shipping/schedule');
  revalidatePath('/shipping/confirm');
  return { success: 'ok', newId: data.id };
}

export async function unreceiveIncoming(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const id = Number(formData.get('id'));
  const supabase = await createClient();

  const { data: incoming } = await supabase
    .from('incoming_stock')
    .select('product_id, quantity')
    .eq('id', id)
    .not('received_at', 'is', null)
    .single();
  if (!incoming) return { error: '入荷済みレコードが見つかりません' };

  await supabase.from('lots').delete().eq('incoming_stock_id', id);

  const { error } = await supabase
    .from('incoming_stock')
    .update({ received_at: null })
    .eq('id', id);
  if (error) return { error: `取り消し失敗: ${error.message}` };

  const { data: inv } = await supabase.from('inventory').select('current_stock').eq('product_id', incoming.product_id).single();
  const localToday = await getLocalDate();
  await supabase.from('inventory').upsert({
    product_id: incoming.product_id,
    current_stock: Math.max(0, (inv?.current_stock ?? 0) - incoming.quantity),
    updated_at: localToday,
  });

  revalidatePath('/incoming');
  revalidatePath('/inventory');
  revalidatePath('/');
  return { success: 'ok' };
}

export async function unshipOutgoing(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const id = Number(formData.get('id'));
  const supabase = await createClient();

  const { data: outgoing } = await supabase
    .from('outgoing_stock')
    .select('product_id, quantity, lot_id')
    .eq('id', id)
    .not('shipped_at', 'is', null)
    .single();
  if (!outgoing) return { error: '出荷済みレコードが見つかりません' };

  const { error } = await supabase
    .from('outgoing_stock')
    .update({ shipped_at: null })
    .eq('id', id);
  if (error) return { error: `取り消し失敗: ${error.message}` };

  const { data: inv } = await supabase.from('inventory').select('current_stock').eq('product_id', outgoing.product_id).single();
  const localToday = await getLocalDate();
  await supabase.from('inventory').upsert({
    product_id: outgoing.product_id,
    current_stock: (inv?.current_stock ?? 0) + outgoing.quantity,
    updated_at: localToday,
  });

  if (outgoing.lot_id) {
    const { data: lot } = await supabase.from('lots').select('quantity').eq('id', outgoing.lot_id).single();
    if (lot) {
      await supabase.from('lots').update({ quantity: lot.quantity + outgoing.quantity }).eq('id', outgoing.lot_id);
    }
  }

  revalidatePath('/shipping/confirm');
  revalidatePath('/shipping/schedule');
  revalidatePath('/inventory');
  return { success: 'ok' };
}

export async function deleteIncomingSchedule(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const id = Number(formData.get('id'));
  const supabase = await createClient();

  const { error } = await supabase
    .from('incoming_stock')
    .delete()
    .eq('id', id)
    .is('received_at', null);

  if (error) return { error: `Failed to delete: ${error.message}` };

  revalidatePath('/incoming');
  revalidatePath('/incoming/schedule');
  revalidatePath('/dashboard');
  return { success: 'ok' };
}

// ─── Outgoing Stock ───────────────────────────────────────────────────────────

export async function addOutgoingSchedule(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const productId = Number(formData.get('product_id'));
  const quantity = Number(formData.get('quantity'));
  const scheduledDate = String(formData.get('scheduled_date') ?? '').trim();
  const note = String(formData.get('note') ?? '').trim() || null;

  if (!productId || isNaN(quantity) || quantity < 1 || !scheduledDate) {
    return { error: 'Invalid input values' };
  }

  const supabase = await createClient();
  const ownerId = await getOwnerId(supabase);
  if (!ownerId) return { error: 'Not authenticated' };

  const { data: product } = await supabase
    .from('products')
    .select('name')
    .eq('id', productId)
    .single();

  if (!product) return { error: 'Product not found' };

  const destinationId = Number(formData.get('destination_id')) || null;
  const carrierId = Number(formData.get('carrier_id')) || null;
  let destinationName: string | null = null;
  let carrierName: string | null = null;
  if (destinationId) {
    const { data: d } = await supabase.from('delivery_destinations').select('name').eq('id', destinationId).single();
    destinationName = d?.name ?? null;
  }
  if (carrierId) {
    const { data: c } = await supabase.from('carriers').select('name').eq('id', carrierId).single();
    carrierName = c?.name ?? null;
  }

  const { error } = await supabase.from('outgoing_stock').insert({
    product_id: productId,
    product_name: product.name,
    quantity,
    scheduled_date: scheduledDate,
    note,
    user_id: ownerId,
    destination_id: destinationId,
    destination_name: destinationName,
    carrier_id: carrierId,
    carrier_name: carrierName,
  });

  if (error) return { error: `Failed to add schedule: ${error.message}` };

  revalidatePath('/shipping/schedule');
  revalidatePath('/shipping/confirm');
  return { success: 'ok' };
}

export async function deleteOutgoingSchedule(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const id = Number(formData.get('id'));
  const supabase = await createClient();

  const { error } = await supabase
    .from('outgoing_stock')
    .delete()
    .eq('id', id)
    .is('shipped_at', null);

  if (error) return { error: `Failed to delete: ${error.message}` };

  revalidatePath('/shipping/schedule');
  revalidatePath('/shipping/confirm');
  return { success: 'ok' };
}

export async function confirmShipment(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const id = Number(formData.get('id'));
  const supabase = await createClient();

  const { data: outgoing, error: fetchError } = await supabase
    .from('outgoing_stock')
    .select('product_id, quantity, lot_id, location_id')
    .eq('id', id)
    .single();

  if (fetchError || !outgoing) {
    return { error: `Item not found: ${fetchError?.message ?? 'unknown error'}` };
  }

  const { data: inv } = await supabase
    .from('inventory')
    .select('current_stock')
    .eq('product_id', outgoing.product_id)
    .single();

  const currentStock = inv?.current_stock ?? 0;
  if (currentStock < outgoing.quantity) {
    return { error: `在庫不足: 現在庫 ${currentStock} 個、出荷予定 ${outgoing.quantity} 個` };
  }

  if (outgoing.lot_id) {
    const { data: lot } = await supabase.from('lots').select('quantity').eq('id', outgoing.lot_id).single();
    const { data: reserved } = await supabase
      .from('outgoing_stock').select('quantity').eq('lot_id', outgoing.lot_id).is('shipped_at', null).neq('id', id);
    const reservedQty = (reserved ?? []).reduce((s: number, r: { quantity: number }) => s + r.quantity, 0);
    const available = (lot?.quantity ?? 0) - reservedQty;
    if (available < outgoing.quantity) {
      return { error: `ロット在庫不足: 引当可能 ${available} 個、出荷予定 ${outgoing.quantity} 個` };
    }
  }

  const { error: updateError } = await supabase
    .from('outgoing_stock')
    .update({ shipped_at: new Date().toISOString() })
    .eq('id', id);

  if (updateError) return { error: `Failed to confirm shipment: ${updateError.message}` };

  const localToday = await getLocalDate();
  const { error: upsertError } = await supabase.from('inventory').upsert({
    product_id: outgoing.product_id,
    current_stock: currentStock - outgoing.quantity,
    updated_at: localToday,
  });

  if (upsertError) return { error: `Failed to update inventory: ${upsertError.message}` };

  if (outgoing.lot_id) {
    const { data: lot } = await supabase.from('lots').select('quantity').eq('id', outgoing.lot_id).single();
    if (lot) {
      await supabase.from('lots').update({ quantity: Math.max(0, lot.quantity - outgoing.quantity) }).eq('id', outgoing.lot_id);
    }
  } else {
    // FIFO: expiry_date → location_id (asc) → lot_number
    let fifoQuery = supabase
      .from('lots').select('id, quantity, lot_number')
      .eq('product_id', outgoing.product_id).gt('quantity', 0);
    if ((outgoing as { location_id?: number | null }).location_id) {
      fifoQuery = fifoQuery.eq('location_id', (outgoing as { location_id?: number | null }).location_id!);
    }
    const { data: fifoLots } = await fifoQuery
      .order('expiry_date', { ascending: true, nullsFirst: false })
      .order('location_id', { ascending: true, nullsFirst: false })
      .order('lot_number', { ascending: true });
    let remaining = outgoing.quantity;
    let firstLotId: number | null = null;
    let firstLotNumber: string | null = null;
    for (const lot of (fifoLots ?? [])) {
      if (remaining <= 0) break;
      if (firstLotId === null) { firstLotId = lot.id; firstLotNumber = lot.lot_number; }
      const take = Math.min(lot.quantity, remaining);
      await supabase.from('lots').update({ quantity: lot.quantity - take }).eq('id', lot.id);
      remaining -= take;
    }
    if (firstLotId !== null) {
      await supabase.from('outgoing_stock').update({ lot_id: firstLotId, lot_number: firstLotNumber }).eq('id', id);
    }
  }

  revalidatePath('/shipping/confirm');
  revalidatePath('/shipping/schedule');
  revalidatePath('/inventory');
  return { success: 'ok' };
}

export async function updateLotQuantity(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const lotId = Number(formData.get('lot_id'));
  const newQty = Number(formData.get('quantity'));
  const supabase = await createClient();

  const { data: lot } = await supabase.from('lots').select('product_id, quantity').eq('id', lotId).single();
  if (!lot) return { error: 'ロットが見つかりません' };

  const { data: reserved } = await supabase
    .from('outgoing_stock').select('quantity').eq('lot_id', lotId).is('shipped_at', null);
  const reservedQty = (reserved ?? []).reduce((s, r) => s + r.quantity, 0);
  if (newQty < reservedQty) {
    return { error: `出荷予定で ${reservedQty} 個確保済みのため、${reservedQty} 個未満には設定できません` };
  }

  const localToday = await getLocalDate();
  await supabase.from('lots').update({ quantity: newQty }).eq('id', lotId);

  const { data: allLots } = await supabase.from('lots').select('quantity').eq('product_id', lot.product_id);
  const totalStock = (allLots ?? []).reduce((s, l) => s + l.quantity, 0);
  await supabase.from('inventory').upsert({
    product_id: lot.product_id,
    current_stock: totalStock,
    updated_at: localToday,
  });

  revalidatePath('/inventory');
  revalidatePath('/inventory/adjust');
  return { success: 'ok' };
}

export async function updateLotProperties(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const lotId = Number(formData.get('lot_id'));
  const lotNumber = String(formData.get('lot_number') ?? '').trim();
  const expiryDate = String(formData.get('expiry_date') ?? '').trim() || null;
  const statusIdRaw = formData.get('status_id');
  const status_id = statusIdRaw && String(statusIdRaw).trim() !== '' ? Number(statusIdRaw) : null;
  const status_name = (formData.get('status_name') as string | null) || null;
  const status_color = (formData.get('status_color') as string | null) || null;

  if (!lotId || !lotNumber) return { error: 'ロット番号は必須です' };

  const supabase = await createClient();

  const { count } = await supabase
    .from('outgoing_stock')
    .select('id', { count: 'exact', head: true })
    .eq('lot_id', lotId)
    .is('shipped_at', null);

  if (count && count > 0) return { error: `出荷予定に引き当てられているため変更できません（${count}件）` };

  const { error } = await supabase
    .from('lots')
    .update({ lot_number: lotNumber, expiry_date: expiryDate, status_id, status_name, status_color })
    .eq('id', lotId);

  if (error) return { error: `更新失敗: ${error.message}` };

  revalidatePath('/inventory');
  revalidatePath('/inventory/[id]', 'page');
  revalidatePath('/inventory/correction');
  return { success: 'ok' };
}


const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export interface OutgoingCsvImportResult {
  imported: number;
  skipped: string[];
  error?: string;
}

export async function importOutgoingCsv(
  _prev: OutgoingCsvImportResult | null,
  formData: FormData
): Promise<OutgoingCsvImportResult> {
  const file = formData.get('file') as File | null;
  if (!file || file.size === 0) return { imported: 0, skipped: [], error: 'No file provided' };

  const supabase = await createClient();
  const ownerId = await getOwnerId(supabase);
  if (!ownerId) return { imported: 0, skipped: [], error: 'Not authenticated' };

  const text = await file.text();
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim().split('\n');
  if (lines.length === 0) return { imported: 0, skipped: [], error: 'File is empty' };

  const firstField = lines[0].split(',')[0].trim().replace(/^"|"$/g, '');
  const dataLines = DATE_RE.test(firstField) ? lines : lines.slice(1);

  const { data: products } = await supabase.from('products').select('id, name');
  const productMap = new Map(
    (products ?? []).map((p) => [p.name.toLowerCase().trim(), p.id])
  );
  const productNameMap = new Map(
    (products ?? []).map((p) => [p.id, p.name])
  );

  const rows: { product_id: number; product_name: string; quantity: number; scheduled_date: string; lot_number: string | null; expiry_date: string | null; note: string | null; user_id: string }[] = [];
  const skipped: string[] = [];

  for (const line of dataLines) {
    if (!line.trim()) continue;
    const parts = line.split(',');
    if (parts.length < 3) { skipped.push(`列数不足: ${line.trim()}`); continue; }
    const [rawDate, rawName, rawQty, rawLot, rawExpiry, rawNote] = parts.map((s) => s.trim().replace(/^"|"$/g, ''));
    const quantity = parseInt(rawQty, 10);
    if (!rawDate || !DATE_RE.test(rawDate)) { skipped.push(`日付形式が不正 (YYYY-MM-DD): ${rawDate || '空'}`); continue; }
    if (!rawName) { skipped.push(`商品名が空: ${line.trim()}`); continue; }
    if (isNaN(quantity) || quantity < 1) { skipped.push(`数量が不正: ${line.trim()}`); continue; }
    const productId = productMap.get(rawName.toLowerCase());
    if (!productId) { skipped.push(`商品マスタに存在しない: ${rawName}`); continue; }
    rows.push({
      product_id: productId,
      product_name: productNameMap.get(productId) ?? rawName,
      quantity,
      scheduled_date: rawDate,
      lot_number: rawLot?.trim() || null,
      expiry_date: rawExpiry?.trim() && DATE_RE.test(rawExpiry.trim()) ? rawExpiry.trim() : null,
      note: rawNote?.trim() || null,
      user_id: ownerId,
    });
  }

  if (rows.length === 0) return { imported: 0, skipped, error: 'No valid rows found' };

  const { error } = await supabase.from('outgoing_stock').insert(rows);
  if (error) return { imported: 0, skipped, error: `Failed to import: ${error.message}` };

  revalidatePath('/shipping/schedule');
  revalidatePath('/shipping/confirm');
  return { imported: rows.length, skipped };
}

export interface IncomingCsvImportResult {
  imported: number;
  skipped: string[];
  error?: string;
}

export async function importIncomingCsv(
  _prev: IncomingCsvImportResult | null,
  formData: FormData
): Promise<IncomingCsvImportResult> {
  const file = formData.get('file') as File | null;
  if (!file || file.size === 0) return { imported: 0, skipped: [], error: 'No file provided' };

  const supabase = await createClient();
  const ownerId = await getOwnerId(supabase);
  if (!ownerId) return { imported: 0, skipped: [], error: 'Not authenticated' };

  const text = await file.text();
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim().split('\n');
  if (lines.length === 0) return { imported: 0, skipped: [], error: 'File is empty' };

  const firstField = lines[0].split(',')[0].trim().replace(/^"|"$/g, '');
  const dataLines = DATE_RE.test(firstField) ? lines : lines.slice(1);

  const { data: products } = await supabase.from('products').select('id, name');
  const productMap = new Map((products ?? []).map((p) => [p.name.toLowerCase().trim(), p.id]));
  const productNameMap = new Map((products ?? []).map((p) => [p.id, p.name]));

  const rows: { product_id: number; product_name: string; quantity: number; expected_date: string; lot_number: string | null; expiry_date: string | null; user_id: string }[] = [];
  const skipped: string[] = [];

  for (const line of dataLines) {
    if (!line.trim()) continue;
    const parts = line.split(',');
    if (parts.length < 3) { skipped.push(`列数不足: ${line.trim()}`); continue; }
    const [rawDate, rawName, rawQty, rawLot, rawExpiry] = parts.map((s) => s.trim().replace(/^"|"$/g, ''));
    const quantity = parseInt(rawQty, 10);
    if (!rawDate || !DATE_RE.test(rawDate)) { skipped.push(`日付形式が不正 (YYYY-MM-DD): ${rawDate || '空'}`); continue; }
    if (!rawName) { skipped.push(`商品名が空: ${line.trim()}`); continue; }
    if (isNaN(quantity) || quantity < 1) { skipped.push(`数量が不正: ${line.trim()}`); continue; }
    const productId = productMap.get(rawName.toLowerCase());
    if (!productId) { skipped.push(`商品マスタに存在しない: ${rawName}`); continue; }
    rows.push({
      product_id: productId,
      product_name: productNameMap.get(productId) ?? rawName,
      quantity,
      expected_date: rawDate,
      lot_number: rawLot?.trim() || null,
      expiry_date: rawExpiry?.trim() && DATE_RE.test(rawExpiry.trim()) ? rawExpiry.trim() : null,
      user_id: ownerId,
    });
  }

  if (rows.length === 0) return { imported: 0, skipped, error: 'インポートできる行がありません' };

  const { error } = await supabase.from('incoming_stock').insert(rows);
  if (error) return { imported: 0, skipped, error: `インポート失敗: ${error.message}` };

  revalidatePath('/incoming/schedule');
  revalidatePath('/incoming');
  revalidatePath('/dashboard');
  return { imported: rows.length, skipped };
}

// ─── Product CSV Import ───────────────────────────────────────────────────────

export interface ProductCsvImportResult {
  imported: number;
  skipped: string[];
  error?: string;
}

export async function importProductsCsv(
  _prev: ProductCsvImportResult | null,
  formData: FormData
): Promise<ProductCsvImportResult> {
  const csv = String(formData.get('csv') ?? '').trim();
  if (!csv) return { imported: 0, skipped: [], error: 'No data provided' };

  const supabase = await createClient();
  const ownerId = await getOwnerId(supabase);
  if (!ownerId) return { imported: 0, skipped: [], error: 'Not authenticated' };

  const lines = csv.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim().split('\n');
  if (lines.length === 0) return { imported: 0, skipped: [], error: 'No data provided' };

  const firstLine = lines[0].toLowerCase();
  const dataLines = firstLine.startsWith('name') || firstLine.startsWith('商品名') ? lines.slice(1) : lines;

  const skipped: string[] = [];
  let imported = 0;

  const localToday = await getLocalDate();

  for (const line of dataLines) {
    if (!line.trim()) continue;
    const parts = line.split(',').map((s) => s.trim().replace(/^"|"$/g, ''));
    const [rawName, rawLeadTime, rawSafetyStock, rawPrice, rawPpb, rawBpc, rawCpp] = parts;

    if (!rawName) { skipped.push(`商品名が空: ${line.trim()}`); continue; }
    const leadTime = parseInt(rawLeadTime ?? '', 10);
    const safetyStock = parseInt(rawSafetyStock ?? '', 10);
    if (isNaN(leadTime) || leadTime < 1) { skipped.push(`リードタイムが不正: ${line.trim()}`); continue; }
    if (isNaN(safetyStock) || safetyStock < 1) { skipped.push(`安全在庫日数が不正: ${line.trim()}`); continue; }

    const price = rawPrice && rawPrice.trim() !== '' ? Number(rawPrice) : null;
    const pieces_per_ball = rawPpb && rawPpb.trim() !== '' ? parseInt(rawPpb, 10) : null;
    const balls_per_case = rawBpc && rawBpc.trim() !== '' ? parseInt(rawBpc, 10) : null;
    const cases_per_pallet = rawCpp && rawCpp.trim() !== '' ? parseInt(rawCpp, 10) : null;

    const { data: product, error } = await supabase
      .from('products')
      .insert({ name: rawName, lead_time_days: leadTime, safety_stock_days: safetyStock, price, pieces_per_ball, balls_per_case, cases_per_pallet, user_id: ownerId })
      .select('id')
      .single();

    if (error || !product) {
      skipped.push(`登録失敗: ${rawName} (${error?.message ?? 'unknown'})`);
      continue;
    }

    await supabase.from('inventory').upsert({
      product_id: product.id,
      current_stock: 0,
      updated_at: localToday,
    });

    imported++;
  }

  if (imported > 0) {
    revalidatePath('/products');
    revalidatePath('/');
  }

  return { imported, skipped };
}

// ─── Suppliers ───────────────────────────────────────────────────────────────

export async function addSupplier(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const name = (formData.get('name') as string ?? '').trim();
  if (!name) return { error: 'Name is required' };
  const supabase = await createClient();
  const ownerId = await getOwnerId(supabase);
  if (!ownerId) return { error: 'Not authenticated' };
  const { error } = await supabase.from('suppliers').insert({
    user_id: ownerId, name,
    contact_name: (formData.get('contact_name') as string ?? '').trim() || null,
    phone: (formData.get('phone') as string ?? '').trim() || null,
    email: (formData.get('email') as string ?? '').trim() || null,
    address: (formData.get('address') as string ?? '').trim() || null,
    note: (formData.get('note') as string ?? '').trim() || null,
  });
  if (error) return { error: `Failed to add: ${error.message}` };
  revalidatePath('/master/suppliers');
  return { success: 'ok' };
}

export async function updateSupplier(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const id = Number(formData.get('id'));
  const name = (formData.get('name') as string ?? '').trim();
  if (!name) return { error: 'Name is required' };
  const supabase = await createClient();
  const { error } = await supabase.from('suppliers').update({
    name,
    contact_name: (formData.get('contact_name') as string ?? '').trim() || null,
    phone: (formData.get('phone') as string ?? '').trim() || null,
    email: (formData.get('email') as string ?? '').trim() || null,
    address: (formData.get('address') as string ?? '').trim() || null,
    note: (formData.get('note') as string ?? '').trim() || null,
  }).eq('id', id);
  if (error) return { error: `Failed to update: ${error.message}` };
  revalidatePath('/master/suppliers');
  return { success: 'ok' };
}

export async function deleteSupplier(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const id = Number(formData.get('id'));
  const supabase = await createClient();
  const { error } = await supabase.from('suppliers').delete().eq('id', id);
  if (error) return { error: `Failed to delete: ${error.message}` };
  revalidatePath('/master/suppliers');
  return { success: 'ok' };
}

// ─── Delivery Destinations ────────────────────────────────────────────────────

export async function addDeliveryDestination(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const name = (formData.get('name') as string ?? '').trim();
  if (!name) return { error: 'Name is required' };
  const supabase = await createClient();
  const ownerId = await getOwnerId(supabase);
  if (!ownerId) return { error: 'Not authenticated' };
  const { error } = await supabase.from('delivery_destinations').insert({
    user_id: ownerId, name,
    contact_name: (formData.get('contact_name') as string ?? '').trim() || null,
    phone: (formData.get('phone') as string ?? '').trim() || null,
    address: (formData.get('address') as string ?? '').trim() || null,
    note: (formData.get('note') as string ?? '').trim() || null,
  });
  if (error) return { error: `Failed to add: ${error.message}` };
  revalidatePath('/master/destinations');
  return { success: 'ok' };
}

export async function updateDeliveryDestination(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const id = Number(formData.get('id'));
  const name = (formData.get('name') as string ?? '').trim();
  if (!name) return { error: 'Name is required' };
  const supabase = await createClient();
  const { error } = await supabase.from('delivery_destinations').update({
    name,
    contact_name: (formData.get('contact_name') as string ?? '').trim() || null,
    phone: (formData.get('phone') as string ?? '').trim() || null,
    address: (formData.get('address') as string ?? '').trim() || null,
    note: (formData.get('note') as string ?? '').trim() || null,
  }).eq('id', id);
  if (error) return { error: `Failed to update: ${error.message}` };
  revalidatePath('/master/destinations');
  return { success: 'ok' };
}

export async function deleteDeliveryDestination(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const id = Number(formData.get('id'));
  const supabase = await createClient();
  const { error } = await supabase.from('delivery_destinations').delete().eq('id', id);
  if (error) return { error: `Failed to delete: ${error.message}` };
  revalidatePath('/master/destinations');
  return { success: 'ok' };
}

// ─── Carriers ─────────────────────────────────────────────────────────────────

export async function addCarrier(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const name = (formData.get('name') as string ?? '').trim();
  if (!name) return { error: 'Name is required' };
  const supabase = await createClient();
  const ownerId = await getOwnerId(supabase);
  if (!ownerId) return { error: 'Not authenticated' };
  const { error } = await supabase.from('carriers').insert({
    user_id: ownerId, name,
    contact_name: (formData.get('contact_name') as string ?? '').trim() || null,
    phone: (formData.get('phone') as string ?? '').trim() || null,
    note: (formData.get('note') as string ?? '').trim() || null,
  });
  if (error) return { error: `Failed to add: ${error.message}` };
  revalidatePath('/master/carriers');
  return { success: 'ok' };
}

export async function updateCarrier(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const id = Number(formData.get('id'));
  const name = (formData.get('name') as string ?? '').trim();
  if (!name) return { error: 'Name is required' };
  const supabase = await createClient();
  const { error } = await supabase.from('carriers').update({
    name,
    contact_name: (formData.get('contact_name') as string ?? '').trim() || null,
    phone: (formData.get('phone') as string ?? '').trim() || null,
    note: (formData.get('note') as string ?? '').trim() || null,
  }).eq('id', id);
  if (error) return { error: `Failed to update: ${error.message}` };
  revalidatePath('/master/carriers');
  return { success: 'ok' };
}

export async function deleteCarrier(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const id = Number(formData.get('id'));
  const supabase = await createClient();
  const { error } = await supabase.from('carriers').delete().eq('id', id);
  if (error) return { error: `Failed to delete: ${error.message}` };
  revalidatePath('/master/carriers');
  return { success: 'ok' };
}

// ─── Inventory Statuses ───────────────────────────────────────────────────────

export async function addInventoryStatus(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const name = (formData.get('name') as string ?? '').trim();
  if (!name) return { error: 'Name is required' };
  const supabase = await createClient();
  const ownerId = await getOwnerId(supabase);
  if (!ownerId) return { error: 'Not authenticated' };
  const { error } = await supabase.from('inventory_statuses').insert({
    user_id: ownerId, name,
    color: (formData.get('color') as string ?? 'slate').trim() || 'slate',
    note: (formData.get('note') as string ?? '').trim() || null,
  });
  if (error) return { error: `Failed to add: ${error.message}` };
  revalidatePath('/master/inventory-statuses');
  return { success: 'ok' };
}

export async function updateInventoryStatus(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const id = Number(formData.get('id'));
  const name = (formData.get('name') as string ?? '').trim();
  if (!name) return { error: 'Name is required' };
  const supabase = await createClient();
  const { error } = await supabase.from('inventory_statuses').update({
    name,
    color: (formData.get('color') as string ?? 'slate').trim() || 'slate',
    note: (formData.get('note') as string ?? '').trim() || null,
  }).eq('id', id);
  if (error) return { error: `Failed to update: ${error.message}` };
  revalidatePath('/master/inventory-statuses');
  return { success: 'ok' };
}

export async function deleteInventoryStatus(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const id = Number(formData.get('id'));
  const supabase = await createClient();
  const { error } = await supabase.from('inventory_statuses').delete().eq('id', id);
  if (error) return { error: `Failed to delete: ${error.message}` };
  revalidatePath('/master/inventory-statuses');
  return { success: 'ok' };
}

// ─── User Profiles ────────────────────────────────────────────────────────────

export async function addUserProfile(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const name = (formData.get('name') as string ?? '').trim();
  if (!name) return { error: 'Name is required' };
  const supabase = await createClient();
  const ownerId = await getOwnerId(supabase);
  if (!ownerId) return { error: 'Not authenticated' };
  const warehouseId = Number(formData.get('warehouse_id')) || null;
  const { error } = await supabase.from('user_profiles').insert({
    user_id: ownerId, name,
    email: (formData.get('email') as string ?? '').trim() || null,
    phone: (formData.get('phone') as string ?? '').trim() || null,
    note: (formData.get('note') as string ?? '').trim() || null,
    role: (formData.get('role') as string ?? 'viewer').trim() || 'viewer',
    worker_code: (formData.get('worker_code') as string ?? '').trim() || null,
    warehouse_id: warehouseId,
    is_active: formData.get('is_active') !== 'false',
  });
  if (error) return { error: `Failed to add: ${error.message}` };
  revalidatePath('/master/users');
  return { success: 'ok' };
}

export async function updateUserProfile(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const id = Number(formData.get('id'));
  const name = (formData.get('name') as string ?? '').trim();
  if (!name) return { error: 'Name is required' };
  const supabase = await createClient();
  const warehouseId = Number(formData.get('warehouse_id')) || null;
  const { error } = await supabase.from('user_profiles').update({
    name,
    email: (formData.get('email') as string ?? '').trim() || null,
    phone: (formData.get('phone') as string ?? '').trim() || null,
    note: (formData.get('note') as string ?? '').trim() || null,
    role: (formData.get('role') as string ?? 'viewer').trim() || 'viewer',
    worker_code: (formData.get('worker_code') as string ?? '').trim() || null,
    warehouse_id: warehouseId,
    is_active: formData.get('is_active') !== 'false',
  }).eq('id', id);
  if (error) return { error: `Failed to update: ${error.message}` };
  revalidatePath('/master/users');
  return { success: 'ok' };
}

export async function deleteUserProfile(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const id = Number(formData.get('id'));
  const supabase = await createClient();
  const { error } = await supabase.from('user_profiles').delete().eq('id', id);
  if (error) return { error: `Failed to delete: ${error.message}` };
  revalidatePath('/master/users');
  return { success: 'ok' };
}

// ─── Warehouses ───────────────────────────────────────────────────────────────

export async function addWarehouse(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const name = (formData.get('name') as string ?? '').trim();
  if (!name) return { error: 'Name is required' };
  const supabase = await createClient();
  const ownerId = await getOwnerId(supabase);
  if (!ownerId) return { error: 'Not authenticated' };
  const { error } = await supabase.from('warehouses').insert({
    user_id: ownerId, name,
    address: (formData.get('address') as string ?? '').trim() || null,
    note: (formData.get('note') as string ?? '').trim() || null,
  });
  if (error) return { error: `Failed to add: ${error.message}` };
  revalidatePath('/master/warehouses');
  return { success: 'ok' };
}

export async function updateWarehouse(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const id = Number(formData.get('id'));
  const name = (formData.get('name') as string ?? '').trim();
  if (!name) return { error: 'Name is required' };
  const supabase = await createClient();
  const { error } = await supabase.from('warehouses').update({
    name,
    address: (formData.get('address') as string ?? '').trim() || null,
    note: (formData.get('note') as string ?? '').trim() || null,
  }).eq('id', id);
  if (error) return { error: `Failed to update: ${error.message}` };
  revalidatePath('/master/warehouses');
  revalidatePath('/master/locations');
  return { success: 'ok' };
}

export async function deleteWarehouse(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const id = Number(formData.get('id'));
  const supabase = await createClient();
  const { error } = await supabase.from('warehouses').delete().eq('id', id);
  if (error) return { error: `Failed to delete: ${error.message}` };
  revalidatePath('/master/warehouses');
  revalidatePath('/master/locations');
  return { success: 'ok' };
}

// ─── Locations ────────────────────────────────────────────────────────────────

export async function addLocation(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const name = (formData.get('name') as string ?? '').trim();
  const warehouseId = Number(formData.get('warehouse_id'));
  if (!name) return { error: 'Name is required' };
  if (!warehouseId) return { error: 'Warehouse is required' };
  const supabase = await createClient();
  const ownerId = await getOwnerId(supabase);
  if (!ownerId) return { error: 'Not authenticated' };
  const { error } = await supabase.from('locations').insert({
    user_id: ownerId, name, warehouse_id: warehouseId,
    note: (formData.get('note') as string ?? '').trim() || null,
  });
  if (error) return { error: `Failed to add: ${error.message}` };
  revalidatePath('/master/locations');
  return { success: 'ok' };
}

export async function updateLocation(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const id = Number(formData.get('id'));
  const name = (formData.get('name') as string ?? '').trim();
  const warehouseId = Number(formData.get('warehouse_id'));
  if (!name) return { error: 'Name is required' };
  if (!warehouseId) return { error: 'Warehouse is required' };
  const supabase = await createClient();
  const { error } = await supabase.from('locations').update({
    name, warehouse_id: warehouseId,
    note: (formData.get('note') as string ?? '').trim() || null,
  }).eq('id', id);
  if (error) return { error: `Failed to update: ${error.message}` };
  revalidatePath('/master/locations');
  return { success: 'ok' };
}

export async function deleteLocation(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const id = Number(formData.get('id'));
  const supabase = await createClient();
  const { error } = await supabase.from('locations').delete().eq('id', id);
  if (error) return { error: `Failed to delete: ${error.message}` };
  revalidatePath('/master/locations');
  return { success: 'ok' };
}

// ─── Master CSV Import ────────────────────────────────────────────────────────

export interface MasterCsvImportResult {
  imported: number;
  skipped: string[];
  error?: string;
}

function parseMasterCsvLines(csv: string): { dataLines: string[]; error?: string } {
  const lines = csv.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim().split('\n').filter((l) => l.trim());
  if (lines.length === 0) return { dataLines: [], error: 'No data provided' };
  const firstField = lines[0].split(',')[0].trim().replace(/^"|"$/g, '').toLowerCase();
  const dataLines = firstField === 'name' || firstField === '名称' || firstField === '名前' ? lines.slice(1) : lines;
  return { dataLines };
}

function parseCsvRow(line: string): string[] {
  return line.split(',').map((s) => s.trim().replace(/^"|"$/g, ''));
}

export async function importSuppliersCsv(
  _prev: MasterCsvImportResult | null,
  formData: FormData
): Promise<MasterCsvImportResult> {
  const csv = String(formData.get('csv') ?? '').trim();
  if (!csv) return { imported: 0, skipped: [], error: 'No data provided' };
  const supabase = await createClient();
  const ownerId = await getOwnerId(supabase);
  if (!ownerId) return { imported: 0, skipped: [], error: 'Not authenticated' };
  const { dataLines, error } = parseMasterCsvLines(csv);
  if (error) return { imported: 0, skipped: [], error };
  let imported = 0;
  const skipped: string[] = [];
  for (const line of dataLines) {
    const [name, contact_name, phone, email, address, note] = parseCsvRow(line);
    if (!name) { skipped.push(`名称が空: ${line}`); continue; }
    const { error: err } = await supabase.from('suppliers').upsert(
      { user_id: ownerId, name, contact_name: contact_name || null, phone: phone || null, email: email || null, address: address || null, note: note || null },
      { onConflict: 'user_id,name' }
    );
    if (err) { skipped.push(`登録失敗: ${name} (${err.message})`); continue; }
    imported++;
  }
  if (imported > 0) revalidatePath('/master/suppliers');
  return { imported, skipped };
}

export async function importDestinationsCsv(
  _prev: MasterCsvImportResult | null,
  formData: FormData
): Promise<MasterCsvImportResult> {
  const csv = String(formData.get('csv') ?? '').trim();
  if (!csv) return { imported: 0, skipped: [], error: 'No data provided' };
  const supabase = await createClient();
  const ownerId = await getOwnerId(supabase);
  if (!ownerId) return { imported: 0, skipped: [], error: 'Not authenticated' };
  const { dataLines, error } = parseMasterCsvLines(csv);
  if (error) return { imported: 0, skipped: [], error };
  let imported = 0;
  const skipped: string[] = [];
  for (const line of dataLines) {
    const [name, contact_name, phone, address, note] = parseCsvRow(line);
    if (!name) { skipped.push(`名称が空: ${line}`); continue; }
    const { error: err } = await supabase.from('delivery_destinations').upsert(
      { user_id: ownerId, name, contact_name: contact_name || null, phone: phone || null, address: address || null, note: note || null },
      { onConflict: 'user_id,name' }
    );
    if (err) { skipped.push(`登録失敗: ${name} (${err.message})`); continue; }
    imported++;
  }
  if (imported > 0) revalidatePath('/master/destinations');
  return { imported, skipped };
}

export async function importCarriersCsv(
  _prev: MasterCsvImportResult | null,
  formData: FormData
): Promise<MasterCsvImportResult> {
  const csv = String(formData.get('csv') ?? '').trim();
  if (!csv) return { imported: 0, skipped: [], error: 'No data provided' };
  const supabase = await createClient();
  const ownerId = await getOwnerId(supabase);
  if (!ownerId) return { imported: 0, skipped: [], error: 'Not authenticated' };
  const { dataLines, error } = parseMasterCsvLines(csv);
  if (error) return { imported: 0, skipped: [], error };
  let imported = 0;
  const skipped: string[] = [];
  for (const line of dataLines) {
    const [name, contact_name, phone, note] = parseCsvRow(line);
    if (!name) { skipped.push(`名称が空: ${line}`); continue; }
    const { error: err } = await supabase.from('carriers').upsert(
      { user_id: ownerId, name, contact_name: contact_name || null, phone: phone || null, note: note || null },
      { onConflict: 'user_id,name' }
    );
    if (err) { skipped.push(`登録失敗: ${name} (${err.message})`); continue; }
    imported++;
  }
  if (imported > 0) revalidatePath('/master/carriers');
  return { imported, skipped };
}

const VALID_COLORS = ['slate', 'green', 'amber', 'red', 'blue', 'purple'];

export async function importInventoryStatusesCsv(
  _prev: MasterCsvImportResult | null,
  formData: FormData
): Promise<MasterCsvImportResult> {
  const csv = String(formData.get('csv') ?? '').trim();
  if (!csv) return { imported: 0, skipped: [], error: 'No data provided' };
  const supabase = await createClient();
  const ownerId = await getOwnerId(supabase);
  if (!ownerId) return { imported: 0, skipped: [], error: 'Not authenticated' };
  const { dataLines, error } = parseMasterCsvLines(csv);
  if (error) return { imported: 0, skipped: [], error };
  let imported = 0;
  const skipped: string[] = [];
  for (const line of dataLines) {
    const [name, color, note] = parseCsvRow(line);
    if (!name) { skipped.push(`名称が空: ${line}`); continue; }
    const resolvedColor = color && VALID_COLORS.includes(color.toLowerCase()) ? color.toLowerCase() : 'slate';
    const { error: err } = await supabase.from('inventory_statuses').upsert(
      { user_id: ownerId, name, color: resolvedColor, note: note || null },
      { onConflict: 'user_id,name' }
    );
    if (err) { skipped.push(`登録失敗: ${name} (${err.message})`); continue; }
    imported++;
  }
  if (imported > 0) revalidatePath('/master/inventory-statuses');
  return { imported, skipped };
}

export async function importUserProfilesCsv(
  _prev: MasterCsvImportResult | null,
  formData: FormData
): Promise<MasterCsvImportResult> {
  const csv = String(formData.get('csv') ?? '').trim();
  if (!csv) return { imported: 0, skipped: [], error: 'No data provided' };
  const supabase = await createClient();
  const ownerId = await getOwnerId(supabase);
  if (!ownerId) return { imported: 0, skipped: [], error: 'Not authenticated' };
  const { dataLines, error } = parseMasterCsvLines(csv);
  if (error) return { imported: 0, skipped: [], error };
  const { data: warehouses } = await supabase.from('warehouses').select('id, name');
  const warehouseMap = new Map((warehouses ?? []).map((w) => [w.name.toLowerCase(), w.id]));
  let imported = 0;
  const skipped: string[] = [];
  const VALID_ROLES = ['admin', 'office', 'warehouse', 'viewer'];
  for (const line of dataLines) {
    const [name, role, worker_code, warehouse_name, is_active, email, phone, note] = parseCsvRow(line);
    if (!name) { skipped.push(`名称が空: ${line}`); continue; }
    const resolvedRole = role && VALID_ROLES.includes(role.toLowerCase()) ? role.toLowerCase() : 'viewer';
    const warehouseId = warehouse_name ? (warehouseMap.get(warehouse_name.toLowerCase()) ?? null) : null;
    const { error: err } = await supabase.from('user_profiles').upsert(
      {
        user_id: ownerId, name,
        role: resolvedRole,
        worker_code: worker_code || null,
        warehouse_id: warehouseId,
        is_active: is_active !== 'false',
        email: email || null,
        phone: phone || null,
        note: note || null,
      },
      { onConflict: 'user_id,name' }
    );
    if (err) { skipped.push(`登録失敗: ${name} (${err.message})`); continue; }
    imported++;
  }
  if (imported > 0) revalidatePath('/master/users');
  return { imported, skipped };
}

export async function importWarehousesCsv(
  _prev: MasterCsvImportResult | null,
  formData: FormData
): Promise<MasterCsvImportResult> {
  const csv = String(formData.get('csv') ?? '').trim();
  if (!csv) return { imported: 0, skipped: [], error: 'No data provided' };
  const supabase = await createClient();
  const ownerId = await getOwnerId(supabase);
  if (!ownerId) return { imported: 0, skipped: [], error: 'Not authenticated' };
  const { dataLines, error } = parseMasterCsvLines(csv);
  if (error) return { imported: 0, skipped: [], error };
  let imported = 0;
  const skipped: string[] = [];
  for (const line of dataLines) {
    const [name, address, note] = parseCsvRow(line);
    if (!name) { skipped.push(`名称が空: ${line}`); continue; }
    const { error: err } = await supabase.from('warehouses').upsert(
      { user_id: ownerId, name, address: address || null, note: note || null },
      { onConflict: 'user_id,name' }
    );
    if (err) { skipped.push(`登録失敗: ${name} (${err.message})`); continue; }
    imported++;
  }
  if (imported > 0) { revalidatePath('/master/warehouses'); revalidatePath('/master/locations'); }
  return { imported, skipped };
}

export async function importLocationsCsv(
  _prev: MasterCsvImportResult | null,
  formData: FormData
): Promise<MasterCsvImportResult> {
  const csv = String(formData.get('csv') ?? '').trim();
  if (!csv) return { imported: 0, skipped: [], error: 'No data provided' };
  const supabase = await createClient();
  const ownerId = await getOwnerId(supabase);
  if (!ownerId) return { imported: 0, skipped: [], error: 'Not authenticated' };
  const { dataLines, error } = parseMasterCsvLines(csv);
  if (error) return { imported: 0, skipped: [], error };
  const { data: warehouses } = await supabase.from('warehouses').select('id, name');
  const warehouseMap = new Map((warehouses ?? []).map((w) => [w.name.toLowerCase(), w.id]));
  let imported = 0;
  const skipped: string[] = [];
  for (const line of dataLines) {
    const [name, warehouseName, note] = parseCsvRow(line);
    if (!name) { skipped.push(`名称が空: ${line}`); continue; }
    if (!warehouseName) { skipped.push(`倉庫名が空: ${line}`); continue; }
    const warehouseId = warehouseMap.get(warehouseName.toLowerCase());
    if (!warehouseId) { skipped.push(`倉庫が見つかりません: ${warehouseName}`); continue; }
    const { error: err } = await supabase.from('locations').upsert(
      { user_id: ownerId, name, warehouse_id: warehouseId, note: note || null },
      { onConflict: 'user_id,warehouse_id,name' }
    );
    if (err) { skipped.push(`登録失敗: ${name} (${err.message})`); continue; }
    imported++;
  }
  if (imported > 0) revalidatePath('/master/locations');
  return { imported, skipped };
}

// ─── Sales Targets ────────────────────────────────────────────────────────────

export async function setMonthlyTarget(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const month = String(formData.get('month') ?? '').trim();
  const amount = Number(formData.get('target_amount'));

  if (!month || isNaN(amount) || amount < 0) return { error: 'Invalid values' };

  const supabase = await createClient();
  const ownerId = await getOwnerId(supabase);
  if (!ownerId) return { error: 'Not authenticated' };

  const { error } = await supabase
    .from('sales_targets')
    .upsert({ user_id: ownerId, month, target_amount: amount }, { onConflict: 'user_id,month' });

  if (error) return { error: `Failed to save target: ${error.message}` };

  revalidatePath('/sales/report');
  return { success: 'ok' };
}

// ─── Sub-user Account Management ─────────────────────────────────────────────

export async function createSubUser(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const profileId = Number(formData.get('profile_id'));
  const loginId = (formData.get('login_id') as string ?? '').trim().toLowerCase();
  const password = (formData.get('password') as string ?? '').trim();

  if (!profileId || !loginId || !password) return { error: 'All fields are required' };
  if (!/^[a-z0-9_.-]+$/.test(loginId)) return { error: 'ログインIDは英数字・記号(_.-) のみ使用できます' };
  if (password.length < 8) return { error: 'Password must be at least 8 characters' };

  const supabase = await createClient();
  const ownerId = await getOwnerId(supabase);
  if (!ownerId) return { error: 'Not authenticated' };

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('id, auth_user_id, user_id')
    .eq('id', profileId)
    .single();

  if (!profile) return { error: 'User profile not found' };
  if (profile.user_id !== ownerId) return { error: 'Access denied' };
  if (profile.auth_user_id) return { error: 'This profile already has a login account' };

  const adminClient = createAdminClient();

  // Check login_id uniqueness across the system
  const { data: existing } = await adminClient
    .from('user_profiles')
    .select('id')
    .eq('login_id', loginId)
    .maybeSingle();
  if (existing) return { error: 'このログインIDはすでに使用されています' };

  // Internal email: loginId@ownerId.internal (never exposed to user)
  const internalEmail = `${loginId}@${ownerId}.internal`;

  const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
    email: internalEmail,
    password,
    email_confirm: true,
  });

  if (createError || !newUser.user) {
    return { error: `Failed to create account: ${createError?.message ?? 'unknown error'}` };
  }

  const { error: memberError } = await adminClient
    .from('tenant_members')
    .insert({ owner_id: ownerId, member_id: newUser.user.id });

  if (memberError) {
    await adminClient.auth.admin.deleteUser(newUser.user.id);
    return { error: `Failed to link account: ${memberError.message}` };
  }

  const { error: profileError } = await adminClient
    .from('user_profiles')
    .update({ auth_user_id: newUser.user.id, login_id: loginId })
    .eq('id', profileId);

  if (profileError) {
    return { error: `Account created but profile link failed: ${profileError.message}` };
  }

  revalidatePath('/master/users');
  return { success: 'ok' };
}

export async function deleteSubUser(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const profileId = Number(formData.get('profile_id'));
  if (!profileId) return { error: 'Profile ID is required' };

  const supabase = await createClient();
  const ownerId = await getOwnerId(supabase);
  if (!ownerId) return { error: 'Not authenticated' };

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('id, auth_user_id, user_id')
    .eq('id', profileId)
    .single();

  if (!profile) return { error: 'User profile not found' };
  if (profile.user_id !== ownerId) return { error: 'Access denied' };
  if (!profile.auth_user_id) return { error: 'This profile has no login account' };

  const adminClient = createAdminClient();

  await adminClient.from('tenant_members').delete().eq('member_id', profile.auth_user_id);
  await adminClient.from('user_profiles').update({ auth_user_id: null, login_id: null }).eq('id', profileId);
  await adminClient.auth.admin.deleteUser(profile.auth_user_id);

  revalidatePath('/master/users');
  return { success: 'ok' };
}

// ─── Role Permissions ─────────────────────────────────────────────────────────

export async function setRolePermissions(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const role = (formData.get('role') as string ?? '').trim();
  if (!role || role === 'admin') return { error: 'Invalid role' };

  const allSections = ['orders', 'incoming', 'inventory', 'shipping', 'sales', 'master', 'products'];
  const sections = allSections.filter((s) => formData.get(`section_${s}`) === 'on');

  const supabase = await createClient();
  const ownerId = await getOwnerId(supabase);
  if (!ownerId) return { error: 'Not authenticated' };

  const { error } = await supabase
    .from('role_permissions')
    .upsert({ user_id: ownerId, role, sections }, { onConflict: 'user_id,role' });

  if (error) return { error: `Failed to save: ${error.message}` };

  revalidatePath('/settings/permissions');
  return { success: 'ok' };
}

// ─── Stock Transfer ───────────────────────────────────────────────────────────

// ─── Cycle Count ─────────────────────────────────────────────────────────────

export interface CycleCountEntry {
  lot_id: number;
  actual_qty: number;
}

export async function saveCycleCount(entries: CycleCountEntry[]): Promise<ActionResult> {
  const changes = entries.filter((e) => e.actual_qty >= 0);
  if (changes.length === 0) return { success: 'ok' };

  const supabase = await createClient();
  if (!await getOwnerId(supabase)) return { error: 'Not authenticated' };

  const localToday = await getLocalDate();

  // Group lot_ids by product_id so we can recalculate inventory per product
  const lotIds = changes.map((e) => e.lot_id);
  const { data: lots } = await supabase.from('lots').select('id, product_id, quantity').in('id', lotIds);
  if (!lots) return { error: 'ロット情報の取得に失敗しました' };

  const lotMap = Object.fromEntries(lots.map((l) => [l.id, l]));

  // Apply updates
  for (const entry of changes) {
    const lot = lotMap[entry.lot_id];
    if (!lot || lot.quantity === entry.actual_qty) continue;
    await supabase.from('lots').update({ quantity: entry.actual_qty }).eq('id', entry.lot_id);
  }

  // Recalculate inventory for each affected product
  const productIds = [...new Set(lots.map((l) => l.product_id))];
  for (const pid of productIds) {
    const { data: allLots } = await supabase.from('lots').select('quantity').eq('product_id', pid);
    const total = (allLots ?? []).reduce((s, l) => s + l.quantity, 0);
    await supabase.from('inventory').upsert({ product_id: pid, current_stock: total, updated_at: localToday });
  }

  revalidatePath('/inventory');
  revalidatePath('/inventory/cycle-count');
  return { success: 'ok' };
}

// ─── Returns ─────────────────────────────────────────────────────────────────

export async function returnOutgoing(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const id = Number(formData.get('id'));
  const returnQty = Number(formData.get('return_qty'));

  if (!id || isNaN(returnQty) || returnQty < 1) return { error: '入力値が不正です' };

  const supabase = await createClient();
  if (!await getOwnerId(supabase)) return { error: 'Not authenticated' };

  const { data: outgoing } = await supabase
    .from('outgoing_stock')
    .select('product_id, quantity, lot_id, returned_qty')
    .eq('id', id)
    .not('shipped_at', 'is', null)
    .single();
  if (!outgoing) return { error: '出荷済みレコードが見つかりません' };

  const alreadyReturned = outgoing.returned_qty ?? 0;
  const maxReturn = outgoing.quantity - alreadyReturned;
  if (returnQty > maxReturn) {
    return { error: `返品数量は${maxReturn}個以下にしてください` };
  }

  const { error } = await supabase
    .from('outgoing_stock')
    .update({ returned_qty: alreadyReturned + returnQty })
    .eq('id', id);
  if (error) return { error: `更新失敗: ${error.message}` };

  const localToday = await getLocalDate();

  if (outgoing.lot_id) {
    const { data: lot } = await supabase.from('lots').select('quantity').eq('id', outgoing.lot_id).single();
    if (lot) {
      await supabase.from('lots').update({ quantity: lot.quantity + returnQty }).eq('id', outgoing.lot_id);
    }
  }

  const { data: inv } = await supabase.from('inventory').select('current_stock').eq('product_id', outgoing.product_id).single();
  await supabase.from('inventory').upsert({
    product_id: outgoing.product_id,
    current_stock: (inv?.current_stock ?? 0) + returnQty,
    updated_at: localToday,
  });

  revalidatePath('/shipping/history');
  revalidatePath('/inventory');
  return { success: 'ok' };
}

export async function transferStock(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const lotId = Number(formData.get('lot_id'));
  const toLocationId = Number(formData.get('to_location_id')) || null;
  const quantity = Number(formData.get('quantity'));
  const note = String(formData.get('note') ?? '').trim() || null;

  if (!lotId || !toLocationId || isNaN(quantity) || quantity < 1) return { error: '入力値が不正です' };

  const supabase = await createClient();
  const ownerId = await getOwnerId(supabase);
  if (!ownerId) return { error: 'Not authenticated' };

  const { data: lot } = await supabase
    .from('lots')
    .select('id, lot_number, product_id, product_name, quantity, received_at, expiry_date, incoming_stock_id, location_id, location_name, warehouse_id')
    .eq('id', lotId)
    .single();
  if (!lot) return { error: 'ロットが見つかりません' };
  if (lot.quantity < quantity) return { error: `在庫が不足しています（残 ${lot.quantity} 個）` };

  const { data: toLoc } = await supabase
    .from('locations').select('name, warehouse_id').eq('id', toLocationId).single();
  if (!toLoc) return { error: 'ロケーションが見つかりません' };

  let toWarehouseName: string | null = null;
  if (toLoc.warehouse_id) {
    const { data: w } = await supabase.from('warehouses').select('name').eq('id', toLoc.warehouse_id).single();
    toWarehouseName = w?.name ?? null;
  }

  if (quantity === lot.quantity) {
    // Full transfer: update location in-place
    await supabase.from('lots').update({
      location_id: toLocationId, location_name: toLoc.name,
      warehouse_id: toLoc.warehouse_id, warehouse_name: toWarehouseName,
    }).eq('id', lotId);
  } else {
    // Partial transfer: reduce source, create new lot at destination
    await supabase.from('lots').update({ quantity: lot.quantity - quantity }).eq('id', lotId);
    await supabase.from('lots').insert({
      lot_number: lot.lot_number, product_id: lot.product_id, product_name: lot.product_name,
      quantity, received_at: lot.received_at, expiry_date: lot.expiry_date,
      incoming_stock_id: lot.incoming_stock_id, user_id: ownerId,
      location_id: toLocationId, location_name: toLoc.name,
      warehouse_id: toLoc.warehouse_id, warehouse_name: toWarehouseName,
    });
  }

  await supabase.from('stock_transfers').insert({
    user_id: ownerId,
    lot_id: lotId,
    product_id: lot.product_id,
    product_name: lot.product_name,
    from_location_id: lot.location_id,
    from_location_name: lot.location_name,
    to_location_id: toLocationId,
    to_location_name: toLoc.name,
    quantity,
    note,
  });

  revalidatePath('/inventory');
  revalidatePath('/inventory/[id]', 'page');
  revalidatePath('/inventory/transfer');
  return { success: 'ok' };
}
