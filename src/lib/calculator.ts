import { createClient } from './supabase';
import type { Product } from './db';
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

export async function getRecommendations(today: Date = new Date()): Promise<Recommendation[]> {
  const supabase = await createClient();
  const { data: products } = await supabase.from('products').select('*').order('id');
  if (!products || products.length === 0) return [];

  const dates = buildDateRange(today);
  const results: Recommendation[] = [];

  for (const product of products as Product[]) {
    const { data: salesData } = await supabase
      .from('sales')
      .select('date, quantity')
      .eq('product_id', product.id)
      .in('date', dates)
      .order('date');

    const sales = salesData ?? [];
    const salesByDate = Object.fromEntries(sales.map((s) => [s.date, s.quantity]));
    const quantities = dates.map((d) => salesByDate[d] ?? 0);

    const avgDemand7d = calcAverageDemand(quantities);
    const { data: inv } = await supabase
      .from('inventory')
      .select('current_stock')
      .eq('product_id', product.id)
      .single();
    const currentStock = inv?.current_stock ?? 0;

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
      product.safety_stock_days
    );

    results.push({ product, avgDemand7d, currentStock, requiredStock, orderQty, reason });
  }

  return results;
}
