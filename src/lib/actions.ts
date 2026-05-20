'use server';

import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { createClient } from './supabase';
import { toLocalDateStr, DEFAULT_TZ } from './tz';

async function getLocalDate(): Promise<string> {
  const store = await cookies();
  const tz = store.get('tz')?.value ?? DEFAULT_TZ;
  return toLocalDateStr(tz);
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
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

  const { data: orderData, error } = await supabase
    .from('order_history')
    .insert({ created_at: new Date().toISOString(), items: JSON.stringify(nonZero), user_id: user.id })
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
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

  const { data: items, error: fetchError } = await supabase
    .from('incoming_stock')
    .select('id, product_id, product_name, quantity, lot_number, expiry_date')
    .in('id', ids)
    .is('received_at', null);
  if (fetchError || !items || items.length === 0) return { error: 'Items not found' };

  const now = new Date();
  const localToday = await getLocalDate();
  const todayStr = localToday.replace(/-/g, '');
  const productIds = [...new Set(items.map((i) => i.product_id))];

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
      expiry_date: expiryDate, incoming_stock_id: item.id, user_id: user.id,
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
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

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
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

  const { data: incoming, error: fetchError } = await supabase
    .from('incoming_stock')
    .select('product_id, product_name, quantity, lot_number')
    .eq('id', id)
    .single();

  if (fetchError || !incoming) {
    return { error: `Item not found: ${fetchError?.message ?? 'unknown error'}` };
  }

  const localToday = await getLocalDate();
  const todayStr = localToday.replace(/-/g, '');
  const lotNumber = formLot || incoming.lot_number || `${todayStr}-${id}`;
  const expiryDate: string | null = formExpiry;

  const { error: updateError } = await supabase
    .from('incoming_stock')
    .update({ received_at: new Date().toISOString(), expiry_date: expiryDate, lot_number: lotNumber })
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
    user_id: user.id,
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

  if (!name || leadTime < 1 || safetyStock < 1) return { error: 'Invalid input values' };
  if (price !== null && (isNaN(price) || price < 0)) return { error: 'Invalid price value' };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

  const { data: product, error } = await supabase
    .from('products')
    .insert({ name, lead_time_days: leadTime, safety_stock_days: safetyStock, price, shelf_life_days, expiry_type, pieces_per_ball, balls_per_case, cases_per_pallet, incoming_fee_per_piece, storage_fee_per_piece, outgoing_fee_per_piece, user_id: user.id })
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

  if (!name || leadTime < 1 || safetyStock < 1) return { error: 'Invalid input values' };
  if (price !== null && (isNaN(price) || price < 0)) return { error: 'Invalid price value' };

  const supabase = await createClient();
  const { error } = await supabase
    .from('products')
    .update({ name, lead_time_days: leadTime, safety_stock_days: safetyStock, price, shelf_life_days, expiry_type, pieces_per_ball, balls_per_case, cases_per_pallet, incoming_fee_per_piece, storage_fee_per_piece, outgoing_fee_per_piece })
    .eq('id', id);

  if (error) return { error: `Failed to update product: ${error.message}` };

  revalidatePath('/products');
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
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

  const rows = dates.map((date, i) => ({
    product_id: productId,
    date,
    quantity: quantities[i] ?? 0,
    user_id: user.id,
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
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { imported: 0, skipped: [], error: 'Not authenticated' };

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
    rows.push({ product_id: productId, date: rawDate, quantity, user_id: user.id });
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
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

  const { data: product } = await supabase
    .from('products')
    .select('name')
    .eq('id', productId)
    .single();

  if (!product) return { error: 'Product not found' };

  const lotNumber = String(formData.get('lot_number') ?? '').trim() || null;

  const { error } = await supabase.from('incoming_stock').insert({
    product_id: productId,
    product_name: product.name,
    quantity,
    expected_date: expectedDate,
    lot_number: lotNumber,
    user_id: user.id,
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

  if (!productId || isNaN(quantity) || quantity < 1 || !expectedDate) {
    return { error: '入力値が不正です' };
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

  const { data: product } = await supabase
    .from('products').select('name').eq('id', productId).single();
  if (!product) return { error: '商品が見つかりません' };

  const { data, error } = await supabase
    .from('incoming_stock')
    .insert({ product_id: productId, product_name: product.name, quantity, expected_date: expectedDate, lot_number: lotNumber, expiry_date: expiryDate, user_id: user.id })
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
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

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

  const { data, error } = await supabase
    .from('outgoing_stock')
    .insert({ product_id: productId, product_name: product.name, quantity, scheduled_date: scheduledDate, note, lot_id: lotId, lot_number: lotNumber })
    .select('id')
    .single();

  if (error || !data) return { error: `追加失敗: ${error?.message}` };

  revalidatePath('/shipping/schedule');
  revalidatePath('/shipping/confirm');
  return { success: 'ok', newId: data.id };
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
  const { data: product } = await supabase
    .from('products')
    .select('name')
    .eq('id', productId)
    .single();

  if (!product) return { error: 'Product not found' };

  const { error } = await supabase.from('outgoing_stock').insert({
    product_id: productId,
    product_name: product.name,
    quantity,
    scheduled_date: scheduledDate,
    note,
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
    .select('product_id, quantity, lot_id')
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
    .update({ lot_number: lotNumber, expiry_date: expiryDate })
    .eq('id', lotId);

  if (error) return { error: `更新失敗: ${error.message}` };

  revalidatePath('/inventory');
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

  const rows: { product_id: number; product_name: string; quantity: number; scheduled_date: string; note: string | null }[] = [];
  const skipped: string[] = [];

  for (const line of dataLines) {
    if (!line.trim()) continue;
    const parts = line.split(',');
    if (parts.length < 3) { skipped.push(`列数不足: ${line.trim()}`); continue; }
    const [rawDate, rawName, rawQty, rawNote] = parts.map((s) => s.trim().replace(/^"|"$/g, ''));
    const quantity = parseInt(rawQty, 10);
    if (!rawName) { skipped.push(`商品名が空: ${line.trim()}`); continue; }
    if (isNaN(quantity) || quantity < 1) { skipped.push(`数量が不正: ${line.trim()}`); continue; }
    if (!rawDate || !DATE_RE.test(rawDate)) { skipped.push(`日付形式が不正 (YYYY-MM-DD): ${rawDate || '空'}`); continue; }
    const productId = productMap.get(rawName.toLowerCase());
    if (!productId) { skipped.push(`商品マスタに存在しない: ${rawName}`); continue; }
    rows.push({
      product_id: productId,
      product_name: productNameMap.get(productId) ?? rawName,
      quantity,
      scheduled_date: rawDate,
      note: rawNote?.trim() || null,
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
  const text = await file.text();
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim().split('\n');
  if (lines.length === 0) return { imported: 0, skipped: [], error: 'File is empty' };

  const firstField = lines[0].split(',')[0].trim().replace(/^"|"$/g, '');
  const dataLines = DATE_RE.test(firstField) ? lines : lines.slice(1);

  const { data: products } = await supabase.from('products').select('id, name');
  const productMap = new Map((products ?? []).map((p) => [p.name.toLowerCase().trim(), p.id]));
  const productNameMap = new Map((products ?? []).map((p) => [p.id, p.name]));

  const rows: { product_id: number; product_name: string; quantity: number; expected_date: string; lot_number: string | null; expiry_date: string | null }[] = [];
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
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { imported: 0, skipped: [], error: 'Not authenticated' };

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
      .insert({ name: rawName, lead_time_days: leadTime, safety_stock_days: safetyStock, price, pieces_per_ball, balls_per_case, cases_per_pallet, user_id: user.id })
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

// ─── Sales Targets ────────────────────────────────────────────────────────────

export async function setMonthlyTarget(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const month = String(formData.get('month') ?? '').trim();
  const amount = Number(formData.get('target_amount'));

  if (!month || isNaN(amount) || amount < 0) return { error: 'Invalid values' };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

  const { error } = await supabase
    .from('sales_targets')
    .upsert({ user_id: user.id, month, target_amount: amount }, { onConflict: 'user_id,month' });

  if (error) return { error: `Failed to save target: ${error.message}` };

  revalidatePath('/sales/report');
  return { success: 'ok' };
}
