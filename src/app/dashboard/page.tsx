import { getRecommendations } from '@/lib/calculator';
import { createClient } from '@/lib/supabase';
import type { Recommendation } from '@/lib/calculator';
import DashboardCharts from '@/components/DashboardCharts';

export const dynamic = 'force-dynamic';

function daysRemaining(r: Recommendation): number | null {
  if (r.avgDemand7d <= 0) return null;
  return r.currentStock / r.avgDemand7d;
}

function stockPct(r: Recommendation): number {
  if (r.requiredStock <= 0) return 100;
  return Math.min(100, (r.currentStock / r.requiredStock) * 100);
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const recommendations = await getRecommendations();

  // Sales trend: last 7 days aggregated by date
  const today = new Date();
  const dates: string[] = [];
  for (let i = 7; i >= 1; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    dates.push(d.toISOString().split('T')[0]);
  }

  const { data: salesData } = await supabase
    .from('sales')
    .select('date, quantity')
    .in('date', dates);

  const totalByDate: Record<string, number> = {};
  for (const d of dates) totalByDate[d] = 0;
  for (const s of salesData ?? []) {
    totalByDate[s.date] = (totalByDate[s.date] ?? 0) + s.quantity;
  }
  const salesTrend = dates.map((d) => ({ date: formatDate(d), total: totalByDate[d] }));

  // Dashboard calculations
  const stockoutRisk = recommendations.filter((r) => {
    const days = daysRemaining(r);
    return days !== null && days < r.product.lead_time_days;
  });

  const overstockRisk = recommendations.filter((r) => {
    if (r.orderQty !== 0) return false;
    const days = daysRemaining(r);
    return days !== null && days > (r.product.lead_time_days + r.product.safety_stock_days) * 3;
  });

  const bestSellers = [...recommendations]
    .filter((r) => r.avgDemand7d > 0)
    .sort((a, b) => b.avgDemand7d - a.avgDemand7d)
    .slice(0, 5)
    .map((r) => ({ name: r.product.name, avgDemand: r.avgDemand7d }));

  const hasAnyPrice = recommendations.some((r) => r.product.price != null);
  const totalOrderValue = hasAnyPrice
    ? recommendations.reduce(
        (sum, r) => sum + (r.product.price != null ? r.orderQty * r.product.price : 0),
        0
      )
    : null;

  if (recommendations.length === 0) {
    return (
      <div>
        <h1 className="text-xl font-bold text-slate-800 mb-1">Dashboard</h1>
        <div className="text-center py-16 text-slate-400">
          <p>No products registered yet</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-slate-800 mb-0.5">Dashboard</h1>
        <p className="text-sm text-slate-500">Today&apos;s snapshot</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3">
        <div className={`rounded-xl border p-4 ${stockoutRisk.length > 0 ? 'border-red-300 bg-red-50' : 'border-slate-200 bg-white'}`}>
          <p className="text-xs text-slate-500">Stockout Risk</p>
          <p className={`text-3xl font-bold mt-1 ${stockoutRisk.length > 0 ? 'text-red-600' : 'text-slate-300'}`}>
            {stockoutRisk.length}
          </p>
          <p className="text-xs text-slate-400 mt-0.5">products</p>
        </div>
        <div className={`rounded-xl border p-4 ${overstockRisk.length > 0 ? 'border-amber-300 bg-amber-50' : 'border-slate-200 bg-white'}`}>
          <p className="text-xs text-slate-500">Overstock</p>
          <p className={`text-3xl font-bold mt-1 ${overstockRisk.length > 0 ? 'text-amber-600' : 'text-slate-300'}`}>
            {overstockRisk.length}
          </p>
          <p className="text-xs text-slate-400 mt-0.5">products</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs text-slate-500">Products</p>
          <p className="text-3xl font-bold text-slate-700 mt-1">{recommendations.length}</p>
          <p className="text-xs text-slate-400 mt-0.5">total</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs text-slate-500">Order Value</p>
          <p className="text-3xl font-bold text-slate-700 mt-1">
            {totalOrderValue !== null
              ? totalOrderValue.toLocaleString(undefined, { maximumFractionDigits: 0 })
              : '—'}
          </p>
          <p className="text-xs text-slate-400 mt-0.5">today&apos;s estimate</p>
        </div>
      </div>

      {/* Charts (client component) */}
      <DashboardCharts salesTrend={salesTrend} bestSellers={bestSellers} />

      {/* Stock status progress bars */}
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <h2 className="text-sm font-semibold text-slate-600 mb-3">Stock Status</h2>
        <div className="space-y-3">
          {recommendations.map((r) => {
            const pct = stockPct(r);
            const barColor =
              pct < 50 ? 'bg-red-500' : pct < 100 ? 'bg-amber-400' : 'bg-green-500';
            return (
              <div key={r.product.id}>
                <div className="flex justify-between text-xs text-slate-600 mb-1">
                  <span className="font-medium truncate mr-2">{r.product.name}</span>
                  <span className="shrink-0 text-slate-400">
                    {r.currentStock} / {r.requiredStock} units
                  </span>
                </div>
                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full ${barColor} rounded-full`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
        <div className="flex gap-4 mt-3 text-xs text-slate-400">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500 inline-block" /> Sufficient</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400 inline-block" /> Low</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500 inline-block" /> Critical</span>
        </div>
      </div>

      {/* Stockout risk detail */}
      {stockoutRisk.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-red-600 mb-2">Stockout Risk</h2>
          <div className="space-y-2">
            {stockoutRisk.map((r) => {
              const days = daysRemaining(r)!;
              return (
                <div key={r.product.id} className="bg-red-50 border border-red-200 rounded-xl p-4">
                  <p className="font-semibold text-slate-800">{r.product.name}</p>
                  <p className="text-xs text-red-600 mt-0.5">
                    {days.toFixed(1)} days of stock remaining — lead time is {r.product.lead_time_days} days
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Overstock detail */}
      {overstockRisk.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-amber-600 mb-2">Overstock</h2>
          <div className="space-y-2">
            {overstockRisk.map((r) => {
              const days = daysRemaining(r)!;
              return (
                <div key={r.product.id} className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                  <p className="font-semibold text-slate-800">{r.product.name}</p>
                  <p className="text-xs text-amber-600 mt-0.5">
                    {days.toFixed(1)} days of stock — recommended {r.product.lead_time_days + r.product.safety_stock_days} days
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
