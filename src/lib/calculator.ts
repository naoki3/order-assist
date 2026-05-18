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

  // Fetch all sales and inventory in two bulk queries instead of per-product queries
  const [{ data: allSales }, { data: allInventory }] = await Promise.all([
    supabase
      .from('sales')
      .select('product_id, date, quantity')
      .in('date', dates),
    supabase
      .from('inventory')
      .select('product_id, current_stock'),
  ]);

  const salesByProduct: Record<number, Record<string, number>> = {};
  for (const s of allSales ?? []) {
    if (!salesByProduct[s.product_id]) salesByProduct[s.product_id] = {};
    salesByProduct[s.product_id][s.date] = s.quantity;
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
      product.safety_stock_days
    );

    return { product, avgDemand7d, currentStock, requiredStock, orderQty, reason };
  });
}
