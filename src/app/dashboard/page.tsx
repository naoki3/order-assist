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

function alertLevel(r: Recommendation): 'stockout' | 'overstock' | null {
  if (r.avgDemand7d <= 0) return null;
  const days = r.currentStock / r.avgDemand7d;
  if (days < r.product.lead_time_days) return 'stockout';
  if (r.orderQty === 0 && r.currentStock > r.requiredStock * 3) return 'overstock';
  return null;
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

  const stockoutRisk = recommendations.filter((r) => alertLevel(r) === 'stockout');
  const overstockRisk = recommendations.filter((r) => alertLevel(r) === 'overstock');

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
        <a href="/" className={`rounded-xl border p-4 block ${stockoutRisk.length > 0 ? 'border-red-300 bg-red-50' : 'border-slate-200 bg-white'}`}>
          <p className="text-xs text-slate-500">{t('dashboard.stockoutRisk', lang)}</p>
          <p className={`text-3xl font-bold mt-1 ${stockoutRisk.length > 0 ? 'text-red-600' : 'text-slate-300'}`}>
            {stockoutRisk.length}
          </p>
          <p className="text-xs text-slate-400 mt-0.5">{t('dashboard.products', lang)}</p>
        </a>
        <div className={`rounded-xl border p-4 ${overstockRisk.length > 0 ? 'border-amber-300 bg-amber-50' : 'border-slate-200 bg-white'}`}>
          <p className="text-xs text-slate-500">{t('dashboard.overstock', lang)}</p>
          <p className={`text-3xl font-bold mt-1 ${overstockRisk.length > 0 ? 'text-amber-600' : 'text-slate-300'}`}>
            {overstockRisk.length}
          </p>
          <p className="text-xs text-slate-400 mt-0.5">{t('dashboard.products', lang)}</p>
        </div>
        <a href="/incoming" className={`rounded-xl border p-4 block ${todayIncoming.length > 0 ? 'border-blue-300 bg-blue-50' : 'border-slate-200 bg-white'}`}>
          <p className="text-xs text-slate-500">{t('dashboard.todayIncoming', lang)}</p>
          <p className={`text-3xl font-bold mt-1 ${todayIncoming.length > 0 ? 'text-blue-600' : 'text-slate-300'}`}>
            {todayIncoming.length}
          </p>
          <p className="text-xs text-slate-400 mt-0.5">{t('dashboard.products', lang)}</p>
        </a>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs text-slate-500">{t('dashboard.orderValue', lang)}</p>
          <p className="text-3xl font-bold text-slate-700 mt-1">
            {totalOrderValue !== null && totalOrderValue > 0
              ? totalOrderValue.toLocaleString(undefined, { maximumFractionDigits: 0 })
              : '—'}
          </p>
          <p className="text-xs text-slate-400 mt-0.5">{t('dashboard.todayEstimate', lang)}</p>
        </div>
      </div>

      {/* Today's incoming detail */}
      {todayIncoming.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
          <h2 className="text-sm font-semibold text-blue-700 mb-2">{t('dashboard.todayIncoming', lang)}</h2>
          <div className="space-y-1.5">
            {todayIncoming.map((item) => (
              <div key={item.id} className="flex items-center justify-between text-sm">
                <span className="text-slate-700 font-medium">{item.product_name}</span>
                <span className="text-slate-500">{item.quantity} {t('dashboard.incomingUnits', lang)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Stock status with inline alerts */}
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <h2 className="text-sm font-semibold text-slate-600 mb-3">{t('dashboard.stockStatus', lang)}</h2>
        <div className="space-y-3">
          {recommendations.map((r) => {
            const pct = stockPct(r);
            const alert = alertLevel(r);
            const days = daysRemaining(r);
            const barColor =
              alert === 'stockout' ? 'bg-red-500' :
              alert === 'overstock' ? 'bg-amber-400' :
              pct >= 100 ? 'bg-green-500' : 'bg-green-400';
            return (
              <div key={r.product.id}>
                <div className="flex items-center justify-between text-xs mb-1 gap-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="font-medium text-slate-700 truncate">{r.product.name}</span>
                    {alert === 'stockout' && (
                      <span className="text-[10px] font-bold text-red-600 bg-red-100 px-1 py-0.5 rounded shrink-0">⚠ 切れ</span>
                    )}
                    {alert === 'overstock' && (
                      <span className="text-[10px] font-bold text-amber-600 bg-amber-100 px-1 py-0.5 rounded shrink-0">過剰</span>
                    )}
                  </div>
                  <span className="text-slate-400 shrink-0">
                    {days !== null ? `残${days.toFixed(1)}日` : `${r.currentStock}${t('dashboard.units', lang)}`}
                  </span>
                </div>
                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div className={`h-full ${barColor} rounded-full transition-all`} style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
        </div>
        <div className="flex gap-4 mt-3 text-xs text-slate-400">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500 inline-block" /> {t('dashboard.sufficient', lang)}</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400 inline-block" /> {t('dashboard.low', lang)}</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500 inline-block" /> {t('dashboard.critical', lang)}</span>
        </div>
      </div>

      {/* Charts */}
      <DashboardCharts salesTrend={salesTrend} bestSellers={bestSellers} />
    </div>
  );
}
