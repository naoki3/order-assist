import { supabase } from './supabase';
import type { Product } from './db';

export interface Recommendation {
  product: Product;
  avgDemand7d: number;
  currentStock: number;
  requiredStock: number;
  orderQty: number;
  reason: string;
}

export async function getRecommendations(): Promise<Recommendation[]> {
  const { data: products } = await supabase.from('products').select('*').order('id');
  if (!products || products.length === 0) return [];

  const today = new Date('2026-03-24');
  const dates: string[] = [];
  for (let i = 7; i >= 1; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    dates.push(d.toISOString().split('T')[0]);
  }

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

    const totalSales = quantities.reduce((sum: number, q: number) => sum + q, 0);
    const avgDemand7d = totalSales / 7;

    const { data: inv } = await supabase
      .from('inventory')
      .select('current_stock')
      .eq('product_id', product.id)
      .single();
    const currentStock = inv?.current_stock ?? 0;

    const requiredStock = Math.ceil(
      avgDemand7d * (product.lead_time_days + product.safety_stock_days)
    );
    const orderQty = Math.max(0, requiredStock - currentStock);

    const recent3dAvg = quantities.slice(-3).reduce((sum: number, q: number) => sum + q, 0) / 3;

    let reason: string;
    if (avgDemand7d === 0) {
      reason = 'No sales data for the past 7 days';
    } else if (orderQty === 0) {
      reason = 'Stock is sufficient, no order needed';
    } else if (recent3dAvg > avgDemand7d * 1.2) {
      reason = `Sales trending up — ordering more (3-day avg: ${recent3dAvg.toFixed(1)} units/day)`;
    } else if (recent3dAvg < avgDemand7d * 0.8) {
      reason = `Sales slowing down (3-day avg: ${recent3dAvg.toFixed(1)} units/day)`;
    } else {
      reason = `Avg demand ${avgDemand7d.toFixed(1)} units/day × ${product.lead_time_days + product.safety_stock_days} days`;
    }

    results.push({ product, avgDemand7d, currentStock, requiredStock, orderQty, reason });
  }

  return results;
}
