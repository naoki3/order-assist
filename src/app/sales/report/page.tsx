import { createClient } from '@/lib/supabase';
import Link from 'next/link';
import type { Product } from '@/lib/db';
import SalesReportCharts from '@/components/SalesReportCharts';
import TargetForm from '@/components/TargetForm';

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Promise<{ period?: string; month?: string }>;
}

function buildDateRange(period: string, month: string | undefined): { from: string; to: string; label: string } {
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];

  if (month) {
    const [y, m] = month.split('-').map(Number);
    const from = `${month}-01`;
    const lastDay = new Date(y, m, 0).getDate();
    const to = `${month}-${String(lastDay).padStart(2, '0')}`;
    return { from, to: to > todayStr ? todayStr : to, label: month };
  }

  const days = period === '30' ? 30 : 7;
  const from = new Date(today);
  from.setDate(today.getDate() - days);
  return {
    from: from.toISOString().split('T')[0],
    to: todayStr,
    label: `Last ${days} days`,
  };
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

export default async function SalesReportPage({ searchParams }: PageProps) {
  const { period = '7', month } = await searchParams;
  const { from, to, label } = buildDateRange(period, month);

  const supabase = await createClient();
  const [{ data: productsData }, { data: salesData }, { data: targetData }] = await Promise.all([
    supabase.from('products').select('*').order('id'),
    supabase.from('sales').select('date, product_id, quantity').gte('date', from).lte('date', to).order('date'),
    supabase.from('sales_targets').select('target_amount').eq('month', to.slice(0, 7)).maybeSingle(),
  ]);

  const products = (productsData ?? []) as Product[];
  const sales = salesData ?? [];
  const priceMap = Object.fromEntries(products.map((p) => [p.id, p.price]));
  const nameMap = Object.fromEntries(products.map((p) => [p.id, p.name]));
  const hasRevenue = products.some((p) => p.price != null);

  // Per-product totals
  const byProduct: Record<number, { units: number; revenue: number }> = {};
  for (const s of sales) {
    if (!byProduct[s.product_id]) byProduct[s.product_id] = { units: 0, revenue: 0 };
    byProduct[s.product_id].units += s.quantity;
    const price = priceMap[s.product_id];
    byProduct[s.product_id].revenue += price != null ? s.quantity * price : 0;
  }

  const totalUnits = Object.values(byProduct).reduce((s, v) => s + v.units, 0);
  const totalRevenue = hasRevenue ? Object.values(byProduct).reduce((s, v) => s + v.revenue, 0) : null;

  // Build days between from and to
  const allDates: string[] = [];
  const cursor = new Date(from + 'T00:00:00');
  const end = new Date(to + 'T00:00:00');
  while (cursor <= end) {
    allDates.push(cursor.toISOString().split('T')[0]);
    cursor.setDate(cursor.getDate() + 1);
  }

  const salesByDate: Record<string, { units: number; revenue: number }> = {};
  for (const s of sales) {
    if (!salesByDate[s.date]) salesByDate[s.date] = { units: 0, revenue: 0 };
    salesByDate[s.date].units += s.quantity;
    const price = priceMap[s.product_id];
    salesByDate[s.date].revenue += price != null ? s.quantity * price : 0;
  }

  const trend = allDates.map((d) => ({
    date: formatDate(d),
    units: salesByDate[d]?.units ?? 0,
    revenue: hasRevenue ? (salesByDate[d]?.revenue ?? 0) : null,
  }));

  const sortedProducts = Object.entries(byProduct)
    .sort((a, b) => b[1].revenue - a[1].revenue || b[1].units - a[1].units)
    .map(([id, v]) => ({ id: Number(id), name: nameMap[Number(id)] ?? id, ...v }));

  const currentMonth = to.slice(0, 7);
  const target = targetData?.target_amount ?? null;
  const achievementPct = totalRevenue != null && target != null && target > 0
    ? Math.min(100, (totalRevenue / target) * 100)
    : null;

  const daysInPeriod = allDates.length;
  const dailyAvgRevenue = totalRevenue != null && daysInPeriod > 0 ? totalRevenue / daysInPeriod : null;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <Link href="/sales" className="text-xs text-slate-400 hover:text-slate-600">← Sales Entry</Link>
          </div>
          <h1 className="text-xl font-bold text-slate-800">Sales Report</h1>
          <p className="text-sm text-slate-500">{label}</p>
        </div>
        {/* Period tabs */}
        <div className="flex gap-1 text-xs">
          {[
            { label: '7 days', href: '/sales/report?period=7' },
            { label: '30 days', href: '/sales/report?period=30' },
            { label: 'This month', href: `/sales/report?month=${new Date().toISOString().slice(0, 7)}` },
          ].map(({ label: l, href }) => {
            const active = href.includes('month')
              ? !!month
              : !month && (period === '7' ? l === '7 days' : l === '30 days');
            return (
              <Link
                key={l}
                href={href}
                className={`px-3 py-1.5 rounded-lg transition-colors ${active ? 'bg-green-700 text-white font-medium' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
              >
                {l}
              </Link>
            );
          })}
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
          <p className="text-xs text-slate-500">Total Units</p>
          <p className="text-3xl font-bold text-slate-700 mt-1">{totalUnits.toLocaleString()}</p>
        </div>
        {totalRevenue != null ? (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
            <p className="text-xs text-slate-500">Total Revenue</p>
            <p className="text-3xl font-bold text-green-700 mt-1">{totalRevenue.toLocaleString()}</p>
          </div>
        ) : (
          <div className="bg-slate-50 rounded-xl border border-slate-200 p-4 flex items-center">
            <p className="text-xs text-slate-400">Set unit prices on products to see revenue</p>
          </div>
        )}
        {dailyAvgRevenue != null && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
            <p className="text-xs text-slate-500">Daily Average</p>
            <p className="text-3xl font-bold text-slate-700 mt-1">{Math.round(dailyAvgRevenue).toLocaleString()}</p>
          </div>
        )}
        {achievementPct !== null && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
            <p className="text-xs text-slate-500">Monthly Target</p>
            <p className="text-3xl font-bold text-slate-700 mt-1">{Math.round(achievementPct)}%</p>
            <div className="h-1.5 bg-slate-100 rounded-full mt-2 overflow-hidden">
              <div
                className={`h-full rounded-full ${achievementPct >= 100 ? 'bg-green-500' : achievementPct >= 70 ? 'bg-amber-400' : 'bg-red-400'}`}
                style={{ width: `${achievementPct}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Charts */}
      <SalesReportCharts trend={trend} hasRevenue={hasRevenue} />

      {/* By product */}
      {sortedProducts.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100">
            <h2 className="text-sm font-semibold text-slate-600">By Product</h2>
          </div>
          <div className="divide-y divide-slate-100">
            {sortedProducts.map((p, i) => (
              <div key={p.id} className="flex items-center gap-3 px-4 py-3">
                <span className="text-sm font-bold text-slate-300 w-5 shrink-0">{i + 1}</span>
                <span className="flex-1 text-sm font-medium text-slate-800 truncate">{p.name}</span>
                <span className="text-sm text-slate-500 shrink-0">{p.units.toLocaleString()} units</span>
                {hasRevenue && (
                  <span className="text-sm font-semibold text-green-700 shrink-0 w-24 text-right">
                    {p.revenue > 0 ? p.revenue.toLocaleString() : '—'}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Monthly target setting */}
      {hasRevenue && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
          <h2 className="text-sm font-semibold text-slate-600 mb-3">Set Target — {currentMonth}</h2>
          <TargetForm month={currentMonth} currentTarget={typeof target === 'number' ? target : null} />
        </div>
      )}

      {sales.length === 0 && (
        <div className="text-center py-12 text-slate-400">
          <p>No sales data for this period</p>
          <Link href="/sales" className="text-sm text-green-700 hover:underline mt-1 block">Go to Sales Entry →</Link>
        </div>
      )}
    </div>
  );
}
