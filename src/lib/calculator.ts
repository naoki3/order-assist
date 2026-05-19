import { createClient } from './supabase';
import type { Product } from './db';
import type { Lang } from './i18n';
import {
  buildDateRange,
  calcAverageDemand,
  calcRequiredStock,
  calcOrderQty,
  buildReason,
} from './calculator-logic';

export interface Recommendation {
  product: Product;
  avgDemand7d: number;
  currentStock: number;
  requiredStock: number;
  orderQty: number;
  reason: string;
}

export async function getRecommendations(today: Date = new Date(), lang: Lang = 'ja'): Promise<Recommendation[]> {
  const supabase = await createClient();
  const { data: products } = await supabase.from('products').select('*').order('id');
  if (!products || products.length === 0) return [];

  const dates = buildDateRange(today);
  const minDate = dates[0];
  const maxDate = dates[dates.length - 1];

  const [{ data: allOutgoing }, { data: allInventory }] = await Promise.all([
    supabase
      .from('outgoing_stock')
      .select('product_id, quantity, shipped_at')
      .not('shipped_at', 'is', null)
      .gte('shipped_at', minDate + 'T00:00:00')
      .lte('shipped_at', maxDate + 'T23:59:59'),
    supabase
      .from('inventory')
      .select('product_id, current_stock'),
  ]);

  const salesByProduct: Record<number, Record<string, number>> = {};
  for (const s of allOutgoing ?? []) {
    if (!s.shipped_at) continue;
    const dateStr = (s.shipped_at as string).slice(0, 10);
    if (!salesByProduct[s.product_id]) salesByProduct[s.product_id] = {};
    salesByProduct[s.product_id][dateStr] = (salesByProduct[s.product_id][dateStr] ?? 0) + s.quantity;
  }

  const stockByProduct: Record<number, number> = {};
  for (const inv of allInventory ?? []) {
    stockByProduct[inv.product_id] = inv.current_stock;
  }

  return (products as Product[]).map((product) => {
    const salesByDate = salesByProduct[product.id] ?? {};
    const quantities = dates.map((d) => salesByDate[d] ?? 0);

    const avgDemand7d = calcAverageDemand(quantities);
    const currentStock = stockByProduct[product.id] ?? 0;

    const requiredStock = calcRequiredStock(
      avgDemand7d,
      product.lead_time_days,
      product.safety_stock_days
    );
    const orderQty = calcOrderQty(requiredStock, currentStock);
    const reason = buildReason(
      avgDemand7d,
      orderQty,
      quantities,
      product.lead_time_days,
      product.safety_stock_days,
      lang
    );

    return { product, avgDemand7d, currentStock, requiredStock, orderQty, reason };
  });
}
