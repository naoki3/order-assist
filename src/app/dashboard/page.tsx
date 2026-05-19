import { getRecommendations } from '@/lib/calculator';
import { getLang } from '@/lib/lang';
import { t, translations } from '@/lib/i18n';
import { createClient } from '@/lib/supabase';
import type { Recommendation } from '@/lib/calculator';
import type { IncomingStock } from '@/lib/db';
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

async function getSalesTrend(): Promise<{ date: string; quantity: number }[]> {
  const today = new Date();
  const dates: string[] = [];
  for (let i = 7; i >= 1; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    dates.push(d.toISOString().split('T')[0]);
  }
  const supabase = await createClient();
  const { data } = await supabase.from('sales').select('date, quantity').in('date', dates);
  return data ?? [];
}

async function getTodayIncoming(): Promise<IncomingStock[]> {
  const today = new Date().toISOString().split('T')[0];
  const supabase = await createClient();
  const { data } = await supabase
    .from('incoming_stock')
    .select('*')
    .eq('expected_date', today)
    .is('received_at', null)
    .order('id');
  return (data ?? []) as IncomingStock[];
}

export default async function DashboardPage() {
  const today = new Date();
  const dates: string[] = [];
  for (let i = 7; i >= 1; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    dates.push(d.toISOString().split('T')[0]);
  }

  const lang = await getLang();
  const [recommendations, salesData, todayIncoming] = await Promise.all([
    getRecommendations(new Date(), lang),
    getSalesTrend(),
    getTodayIncoming(),
  ]);
  const dict = translations[lang];

  const totalByDate: Record<string, number> = {};
  for (const d of dates) totalByDate[d] = 0;
  for (const s of salesData ?? []) {
    totalByDate[s.date] = (totalByDate[s.date] ?? 0) + s.quantity;
  }
  const salesTrend = dates.map((d) => ({ date: formatDate(d), total: totalByDate[d] }));

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

  const hasAnyOrderedPrice = recommendations.some((r) => r.orderQty > 0 && r.product.price != null);
  const totalOrderValue = hasAnyOrderedPrice
    ? recommendations.reduce(
        (sum, r) => sum + (r.product.price != null ? r.orderQty * r.product.price : 0),
        0
      )
    : null;

  if (recommendations.length === 0) {
    return (
      <div>
        <h1 className="text-xl font-bold text-slate-800 mb-1">{t('dashboard.title', lang)}</h1>
        <div className="text-center py-16 text-slate-400">
          <p>{t('dashboard.noProducts', lang)}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-slate-800 mb-0.5">{t('dashboard.title', lang)}</h1>
        <p className="text-sm text-slate-500">{t('dashboard.snapshot', lang)}</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3">
        <div className={`rounded-xl border p-4 ${stockoutRisk.length > 0 ? 'border-red-300 bg-red-50' : 'border-slate-200 bg-white'}`}>
          <p className="text-xs text-slate-500">{t('dashboard.stockoutRisk', lang)}</p>
          <p className={`text-3xl font-bold mt-1 ${stockoutRisk.length > 0 ? 'text-red-600' : 'text-slate-300'}`}>
            {stockoutRisk.length}
          </p>
          <p className="text-xs text-slate-400 mt-0.5">{t('dashboard.products', lang)}</p>
        </div>
        <div className={`rounded-xl border p-4 ${overstockRisk.length > 0 ? 'border-amber-300 bg-amber-50' : 'border-slate-200 bg-white'}`}>
          <p className="text-xs text-slate-500">{t('dashboard.overstock', lang)}</p>
          <p className={`text-3xl font-bold mt-1 ${overstockRisk.length > 0 ? 'text-amber-600' : 'text-slate-300'}`}>
            {overstockRisk.length}
          </p>
          <p className="text-xs text-slate-400 mt-0.5">{t('dashboard.products', lang)}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs text-slate-500">{t('dashboard.products', lang)}</p>
          <p className="text-3xl font-bold text-slate-700 mt-1">{recommendations.length}</p>
          <p className="text-xs text-slate-400 mt-0.5">{t('dashboard.total', lang)}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs text-slate-500">{t('dashboard.orderValue', lang)}</p>
          <p className="text-3xl font-bold text-slate-700 mt-1">
            {totalOrderValue !== null
              ? totalOrderValue.toLocaleString(undefined, { maximumFractionDigits: 0 })
              : '—'}
          </p>
          <p className="text-xs text-slate-400 mt-0.5">{t('dashboard.todayEstimate', lang)}</p>
        </div>
      </div>

      {/* Charts (client component) */}
      <DashboardCharts salesTrend={salesTrend} bestSellers={bestSellers} />

      {/* Stock status progress bars */}
      {(() => {
        const lowStock = recommendations.filter((r) => stockPct(r) < 100);
        return (
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <h2 className="text-sm font-semibold text-slate-600 mb-3">{t('dashboard.stockStatus', lang)}</h2>
            {lowStock.length === 0 ? (
              <p className="text-sm text-slate-400">{t('dashboard.allSufficient', lang)}</p>
            ) : (
              <div className="space-y-3">
                {lowStock.map((r) => {
                  const pct = stockPct(r);
                  const barColor = pct < 50 ? 'bg-red-500' : 'bg-amber-400';
                  const days = daysRemaining(r);
                  return (
                    <div key={r.product.id}>
                      <div className="flex justify-between text-xs text-slate-600 mb-1">
                        <span className="font-medium truncate mr-2">{r.product.name}</span>
                        <span className="shrink-0 text-slate-400">
                          {r.currentStock} / {r.requiredStock} {t('dashboard.units', lang)}
                        </span>
                      </div>
                      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full ${barColor} rounded-full`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      {days !== null && (
                        <p className="text-xs text-slate-400 mt-0.5 font-mono">
                          {(dict['dashboard.stockoutFormula'] as (s: number, d: string, day: string, l: number) => string)(
                            r.currentStock,
                            r.avgDemand7d.toFixed(1),
                            days.toFixed(1),
                            r.product.lead_time_days
                          )}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
            <div className="flex gap-4 mt-3 text-xs text-slate-400">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400 inline-block" /> {t('dashboard.low', lang)}</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500 inline-block" /> {t('dashboard.critical', lang)}</span>
            </div>
          </div>
        );
      })()}

      {/* Stockout risk detail */}
      {stockoutRisk.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-red-600 mb-2">{t('dashboard.stockoutRisk', lang)}</h2>
          <div className="space-y-2">
            {stockoutRisk.map((r) => {
              const days = daysRemaining(r)!;
              return (
                <div key={r.product.id} className="bg-red-50 border border-red-200 rounded-xl p-4">
                  <p className="font-semibold text-slate-800">{r.product.name}</p>
                  <p className="text-xs text-red-600 mt-0.5">
                    {(dict['dashboard.daysRemaining'] as (d: string, l: number) => string)(days.toFixed(1), r.product.lead_time_days)}
                  </p>
                  <p className="text-xs text-slate-400 mt-1 font-mono">
                    {(dict['dashboard.stockoutFormula'] as (s: number, d: string, day: string, l: number) => string)(
                      r.currentStock,
                      r.avgDemand7d.toFixed(1),
                      days.toFixed(1),
                      r.product.lead_time_days
                    )}
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
          <h2 className="text-sm font-semibold text-amber-600 mb-2">{t('dashboard.overstock', lang)}</h2>
          <div className="space-y-2">
            {overstockRisk.map((r) => {
              const days = daysRemaining(r)!;
              return (
                <div key={r.product.id} className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                  <p className="font-semibold text-slate-800">{r.product.name}</p>
                  <p className="text-xs text-amber-600 mt-0.5">
                    {(dict['dashboard.overstockDays'] as (d: string, r: number) => string)(days.toFixed(1), r.product.lead_time_days + r.product.safety_stock_days)}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Today's incoming */}
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <h2 className="text-sm font-semibold text-slate-600 mb-3">{t('dashboard.todayIncoming', lang)}</h2>
        {todayIncoming.length === 0 ? (
          <p className="text-sm text-slate-400">{t('dashboard.noTodayIncoming', lang)}</p>
        ) : (
          <div className="space-y-2">
            {todayIncoming.map((item) => (
              <div key={item.id} className="flex items-center justify-between text-sm">
                <span className="text-slate-700 font-medium">{item.product_name}</span>
                <span className="text-slate-500">{item.quantity} {t('dashboard.incomingUnits', lang)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
