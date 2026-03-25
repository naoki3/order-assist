'use server';

import { revalidatePath } from 'next/cache';
import { supabase } from './supabase';

// ─── Order ───────────────────────────────────────────────────────────────────

export interface OrderItem {
  productId: number;
  productName: string;
  quantity: number;
}

export async function placeOrder(items: OrderItem[]) {
  const nonZero = items.filter((i) => i.quantity > 0);
  if (nonZero.length === 0) return { success: false, message: 'All order quantities are 0' };

  const { data: orderData, error } = await supabase
    .from('order_history')
    .insert({ created_at: new Date().toISOString(), items: JSON.stringify(nonZero) })
    .select('id')
    .single();

  if (error || !orderData) return { success: false, message: 'Failed to place order' };

  const orderHistoryId = orderData.id;
  const today = new Date('2026-03-24');

  const incomingRows = await Promise.all(
    nonZero.map(async (item) => {
      const { data: product } = await supabase
        .from('products')
        .select('lead_time_days')
        .eq('id', item.productId)
        .single();
      const leadDays = product?.lead_time_days ?? 1;
      const expected = new Date(today);
      expected.setDate(today.getDate() + leadDays);
      return {
        order_history_id: orderHistoryId,
        product_id: item.productId,
        product_name: item.productName,
        quantity: item.quantity,
        expected_date: expected.toISOString().split('T')[0],
      };
    })
  );

  await supabase.from('incoming_stock').insert(incomingRows);

  revalidatePath('/history');
  revalidatePath('/incoming');
  return { success: true };
}

export async function receiveIncoming(formData: FormData) {
  const id = Number(formData.get('id'));

  const { data: incoming } = await supabase
    .from('incoming_stock')
    .select('product_id, quantity')
    .eq('id', id)
    .single();

  if (!incoming) return;

  await supabase
    .from('incoming_stock')
    .update({ received_at: new Date().toISOString() })
    .eq('id', id);

  const { data: inv } = await supabase
    .from('inventory')
    .select('current_stock')
    .eq('product_id', incoming.product_id)
    .single();

  await supabase.from('inventory').upsert({
    product_id: incoming.product_id,
    current_stock: (inv?.current_stock ?? 0) + incoming.quantity,
    updated_at: new Date().toISOString().split('T')[0],
  });

  revalidatePath('/incoming');
  revalidatePath('/');
  revalidatePath('/products');
}

// ─── Products ────────────────────────────────────────────────────────────────

export async function addProduct(formData: FormData): Promise<void> {
  const name = (formData.get('name') as string).trim();
  const leadTime = Number(formData.get('lead_time_days'));
  const safetyStock = Number(formData.get('safety_stock_days'));

  if (!name || leadTime < 1 || safetyStock < 1) return;

  const { data: product } = await supabase
    .from('products')
    .insert({ name, lead_time_days: leadTime, safety_stock_days: safetyStock })
    .select('id')
    .single();

  if (!product) return;

  await supabase.from('inventory').upsert({
    product_id: product.id,
    current_stock: 0,
    updated_at: new Date().toISOString().split('T')[0],
  });

  revalidatePath('/products');
  revalidatePath('/');
}

export async function updateProduct(formData: FormData): Promise<void> {
  const id = Number(formData.get('id'));
  const name = (formData.get('name') as string).trim();
  const leadTime = Number(formData.get('lead_time_days'));
  const safetyStock = Number(formData.get('safety_stock_days'));

  if (!name || leadTime < 1 || safetyStock < 1) return;

  await supabase
    .from('products')
    .update({ name, lead_time_days: leadTime, safety_stock_days: safetyStock })
    .eq('id', id);

  revalidatePath('/products');
  revalidatePath('/');
}

export async function deleteProduct(formData: FormData) {
  const id = Number(formData.get('id'));
  await supabase.from('products').delete().eq('id', id);
  revalidatePath('/products');
  revalidatePath('/');
}

// ─── Inventory ────────────────────────────────────────────────────────────────

export async function updateStock(formData: FormData) {
  const productId = Number(formData.get('product_id'));
  const stock = Number(formData.get('current_stock'));

  await supabase.from('inventory').upsert({
    product_id: productId,
    current_stock: stock,
    updated_at: new Date().toISOString().split('T')[0],
  });

  revalidatePath('/');
  revalidatePath('/products');
}

// ─── Sales ───────────────────────────────────────────────────────────────────

export async function upsertSale(formData: FormData): Promise<void> {
  const productId = Number(formData.get('product_id'));
  const date = formData.get('date') as string;
  const quantity = Number(formData.get('quantity'));

  if (!date || isNaN(quantity) || quantity < 0) return;

  await supabase
    .from('sales')
    .upsert({ product_id: productId, date, quantity }, { onConflict: 'product_id,date' });

  revalidatePath('/sales');
  revalidatePath('/');
}
