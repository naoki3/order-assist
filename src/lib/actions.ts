'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from './supabase';

export type ActionResult = { error: string } | null;

// ─── Order ───────────────────────────────────────────────────────────────────

export interface OrderItem {
  productId: number;
  productName: string;
  quantity: number;
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

  const orderHistoryId = orderData.id;
  const today = new Date();

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

  const { error: insertError } = await supabase.from('incoming_stock').insert(incomingRows);
  if (insertError) {
    return { error: `Order placed but failed to register incoming stock: ${insertError.message}` };
  }

  revalidatePath('/history');
  revalidatePath('/incoming');
  return null;
}

export async function receiveIncoming(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const id = Number(formData.get('id'));
  const supabase = await createClient();

  const { data: incoming, error: fetchError } = await supabase
    .from('incoming_stock')
    .select('product_id, quantity')
    .eq('id', id)
    .single();

  if (fetchError || !incoming) {
    return { error: `Item not found: ${fetchError?.message ?? 'unknown error'}` };
  }

  const { error: updateError } = await supabase
    .from('incoming_stock')
    .update({ received_at: new Date().toISOString() })
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
    updated_at: new Date().toISOString().split('T')[0],
  });

  if (upsertError) return { error: `Failed to update inventory: ${upsertError.message}` };

  revalidatePath('/incoming');
  revalidatePath('/');
  revalidatePath('/products');
  return null;
}

// ─── Products ────────────────────────────────────────────────────────────────

export async function addProduct(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const name = (formData.get('name') as string).trim();
  const leadTime = Number(formData.get('lead_time_days'));
  const safetyStock = Number(formData.get('safety_stock_days'));

  if (!name || leadTime < 1 || safetyStock < 1) return { error: 'Invalid input values' };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

  const { data: product, error } = await supabase
    .from('products')
    .insert({ name, lead_time_days: leadTime, safety_stock_days: safetyStock, user_id: user.id })
    .select('id')
    .single();

  if (error || !product) {
    return { error: `Failed to add product: ${error?.message ?? 'unknown error'}` };
  }

  const { error: invError } = await supabase.from('inventory').upsert({
    product_id: product.id,
    current_stock: 0,
    updated_at: new Date().toISOString().split('T')[0],
  });

  if (invError) {
    return { error: `Product added but failed to initialize inventory: ${invError.message}` };
  }

  revalidatePath('/products');
  revalidatePath('/');
  return null;
}

export async function updateProduct(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const id = Number(formData.get('id'));
  const name = (formData.get('name') as string).trim();
  const leadTime = Number(formData.get('lead_time_days'));
  const safetyStock = Number(formData.get('safety_stock_days'));

  if (!name || leadTime < 1 || safetyStock < 1) return { error: 'Invalid input values' };

  const supabase = await createClient();
  const { error } = await supabase
    .from('products')
    .update({ name, lead_time_days: leadTime, safety_stock_days: safetyStock })
    .eq('id', id);

  if (error) return { error: `Failed to update product: ${error.message}` };

  revalidatePath('/products');
  revalidatePath('/');
  return null;
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
  return null;
}

// ─── Inventory ────────────────────────────────────────────────────────────────

export async function updateStock(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const productId = Number(formData.get('product_id'));
  const stock = Number(formData.get('current_stock'));
  const supabase = await createClient();

  const { error } = await supabase.from('inventory').upsert({
    product_id: productId,
    current_stock: stock,
    updated_at: new Date().toISOString().split('T')[0],
  });

  if (error) return { error: `Failed to update stock: ${error.message}` };

  revalidatePath('/');
  revalidatePath('/products');
  return null;
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
  return null;
}
