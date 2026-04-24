import { getRecommendations } from '@/lib/calculator';
import type { Recommendation } from '@/lib/calculator';

export const dynamic = 'force-dynamic';

function daysRemaining(r: Recommendation): number | null {
  if (r.avgDemand7d <= 0) return null;
  return r.currentStock / r.avgDemand7d;
}

export default async function DashboardPage() {
  const recommendations = await getRecommendations();

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
    .slice(0, 5);

  const hasAnyPrice = recommendations.some((r) => r.product.price != null);
  const totalOrderValue = hasAnyPrice
    ? recommendations.reduce((sum, r) => {
        return sum + (r.product.price != null ? r.orderQty * r.product.price : 0);
      }, 0)
    : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-800 mb-1">Dashboard</h1>
        <p className="text-sm text-slate-500">Overview based on today&apos;s calculations</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3">
        <div className={`rounded-xl border p-4 ${stockoutRisk.length > 0 ? 'border-red-300 bg-red-50' : 'border-slate-200 bg-white'}`}>
          <p className="text-xs text-slate-500 mb-1">Stockout Risk</p>
          <p className={`text-2xl font-bold ${stockoutRisk.length > 0 ? 'text-red-600' : 'text-slate-300'}`}>
            {stockoutRisk.length}
          </p>
          <p className="text-xs text-slate-400 mt-0.5">products</p>
        </div>
        <div className={`rounded-xl border p-4 ${overstockRisk.length > 0 ? 'border-amber-300 bg-amber-50' : 'border-slate-200 bg-white'}`}>
          <p className="text-xs text-slate-500 mb-1">Overstock</p>
          <p className={`text-2xl font-bold ${overstockRisk.length > 0 ? 'text-amber-600' : 'text-slate-300'}`}>
            {overstockRisk.length}
          </p>
          <p className="text-xs text-slate-400 mt-0.5">products</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs text-slate-500 mb-1">Products</p>
          <p className="text-2xl font-bold text-slate-700">{recommendations.length}</p>
          <p className="text-xs text-slate-400 mt-0.5">total</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs text-slate-500 mb-1">Order Value</p>
          <p className="text-2xl font-bold text-slate-700">
            {totalOrderValue !== null
              ? totalOrderValue.toLocaleString(undefined, { minimumFractionDigits: 0 })
              : '—'}
          </p>
          <p className="text-xs text-slate-400 mt-0.5">today&apos;s estimate</p>
        </div>
      </div>

      {/* Stockout risk */}
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

      {/* Overstock risk */}
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

      {/* Best sellers */}
      {bestSellers.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-slate-600 mb-2">Best Sellers</h2>
          <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-100">
            {bestSellers.map((r, i) => (
              <div key={r.product.id} className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-bold text-slate-300 w-4">{i + 1}</span>
                  <span className="text-sm font-medium text-slate-800">{r.product.name}</span>
                </div>
                <span className="text-sm text-slate-500">{r.avgDemand7d.toFixed(1)} units/day</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {recommendations.length === 0 && (
        <div className="text-center py-16 text-slate-400">
          <p>No products registered yet</p>
        </div>
      )}
    </div>
  );
}
