'use server';

import { revalidatePath } from 'next/cache';
import { getDb, type Product } from './db';

// ─── Order ───────────────────────────────────────────────────────────────────

export interface OrderItem {
  productId: number;
  productName: string;
  quantity: number;
}

export async function placeOrder(items: OrderItem[]) {
  const db = getDb();
  const nonZero = items.filter((i) => i.quantity > 0);
  if (nonZero.length === 0) return { success: false, message: '発注数が0の商品しかありません' };

  const result = db.prepare(
    'INSERT INTO order_history (created_at, items) VALUES (?, ?)'
  ).run(new Date().toISOString(), JSON.stringify(nonZero));

  const orderHistoryId = result.lastInsertRowid as number;

  const insertIncoming = db.prepare(
    'INSERT INTO incoming_stock (order_history_id, product_id, product_name, quantity, expected_date) VALUES (?, ?, ?, ?, ?)'
  );

  const insertIncomingTx = db.transaction(() => {
    for (const item of nonZero) {
      const product = db.prepare('SELECT lead_time_days FROM products WHERE id = ?').get(item.productId) as Pick<Product, 'lead_time_days'> | undefined;
      const leadDays = product?.lead_time_days ?? 1;
      const expected = new Date('2026-03-24');
      expected.setDate(expected.getDate() + leadDays);
      const expectedDate = expected.toISOString().split('T')[0];
      insertIncoming.run(orderHistoryId, item.productId, item.productName, item.quantity, expectedDate);
    }
  });
  insertIncomingTx();

  revalidatePath('/history');
  revalidatePath('/incoming');
  return { success: true };
}

export async function receiveIncoming(formData: FormData) {
  const id = Number(formData.get('id'));
  const db = getDb();

  const incoming = db.prepare('SELECT * FROM incoming_stock WHERE id = ?').get(id) as { product_id: number; quantity: number } | undefined;
  if (!incoming) return;

  db.transaction(() => {
    db.prepare(
      "UPDATE incoming_stock SET received_at = datetime('now') WHERE id = ?"
    ).run(id);
    db.prepare(
      "INSERT INTO inventory (product_id, current_stock, updated_at) VALUES (?, ?, date('now')) ON CONFLICT(product_id) DO UPDATE SET current_stock = current_stock + excluded.current_stock, updated_at = excluded.updated_at"
    ).run(incoming.product_id, incoming.quantity);
  })();

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

  const db = getDb();
  const result = db
    .prepare('INSERT INTO products (name, lead_time_days, safety_stock_days) VALUES (?, ?, ?)')
    .run(name, leadTime, safetyStock);

  const productId = result.lastInsertRowid as number;
  db.prepare(
    "INSERT OR IGNORE INTO inventory (product_id, current_stock, updated_at) VALUES (?, 0, date('now'))"
  ).run(productId);

  revalidatePath('/products');
  revalidatePath('/');
}

export async function updateProduct(formData: FormData): Promise<void> {
  const id = Number(formData.get('id'));
  const name = (formData.get('name') as string).trim();
  const leadTime = Number(formData.get('lead_time_days'));
  const safetyStock = Number(formData.get('safety_stock_days'));

  if (!name || leadTime < 1 || safetyStock < 1) return;

  getDb()
    .prepare('UPDATE products SET name=?, lead_time_days=?, safety_stock_days=? WHERE id=?')
    .run(name, leadTime, safetyStock, id);

  revalidatePath('/products');
  revalidatePath('/');
}

export async function deleteProduct(formData: FormData) {
  const id = Number(formData.get('id'));
  getDb().prepare('DELETE FROM products WHERE id=?').run(id);
  revalidatePath('/products');
  revalidatePath('/');
}

// ─── Inventory ───────────────────────────────────────────────────────────────

export async function updateStock(formData: FormData) {
  const productId = Number(formData.get('product_id'));
  const stock = Number(formData.get('current_stock'));

  getDb()
    .prepare(
      "INSERT INTO inventory (product_id, current_stock, updated_at) VALUES (?, ?, date('now')) ON CONFLICT(product_id) DO UPDATE SET current_stock=excluded.current_stock, updated_at=excluded.updated_at"
    )
    .run(productId, stock);

  revalidatePath('/');
  revalidatePath('/products');
}

// ─── Sales ───────────────────────────────────────────────────────────────────

export async function upsertSale(formData: FormData): Promise<void> {
  const productId = Number(formData.get('product_id'));
  const date = formData.get('date') as string;
  const quantity = Number(formData.get('quantity'));

  if (!date || isNaN(quantity) || quantity < 0) return;

  getDb()
    .prepare(
      'INSERT INTO sales (product_id, date, quantity) VALUES (?, ?, ?) ON CONFLICT(product_id, date) DO UPDATE SET quantity=excluded.quantity'
    )
    .run(productId, date, quantity);

  revalidatePath('/sales');
  revalidatePath('/');
}
