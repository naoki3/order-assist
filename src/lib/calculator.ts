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
      reason = '過去7日間の売上データがありません';
    } else if (orderQty === 0) {
      reason = '在庫が十分なため発注不要';
    } else if (recent3dAvg > avgDemand7d * 1.2) {
      reason = `最近売上が増えているため多めに発注（直近3日平均 ${recent3dAvg.toFixed(1)}個/日）`;
    } else if (recent3dAvg < avgDemand7d * 0.8) {
      reason = `最近売上が落ち着いています（直近3日平均 ${recent3dAvg.toFixed(1)}個/日）`;
    } else {
      reason = `平均需要 ${avgDemand7d.toFixed(1)}個/日 × ${product.lead_time_days + product.safety_stock_days}日分`;
    }

    results.push({ product, avgDemand7d, currentStock, requiredStock, orderQty, reason });
  }

  return results;
}
