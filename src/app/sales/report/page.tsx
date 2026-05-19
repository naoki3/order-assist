import { createClient } from '@/lib/supabase';
import { getLang } from '@/lib/lang';
import { t, translations } from '@/lib/i18n';
import Link from 'next/link';
import type { Product } from '@/lib/db';
import SalesReportCharts from '@/components/SalesReportCharts';
import TargetForm from '@/components/TargetForm';

interface IncomingRow { product_id: number; quantity: number; received_at: string }
interface OutgoingRow { product_id: number; quantity: number; shipped_at: string }

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Promise<{ period?: string; month?: string }>;
}

function buildDateRange(period: string, month: string | undefined, langLabel: string): { from: string; to: string; label: string } {
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
    label: langLabel,
  };
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

export default async function SalesReportPage({ searchParams }: PageProps) {
  const { period = '7', month } = await searchParams;
  const lang = await getLang();
  const dict = translations[lang];

  const periodLabel = (dict['report.lastNDays'] as (n: number) => string)(period === '30' ? 30 : 7);
  const { from, to, label } = buildDateRange(period, month, periodLabel);

  const supabase = await createClient();
  const fromTs = from + 'T00:00:00.000Z';
  const toTs = to + 'T23:59:59.999Z';
  const [{ data: productsData }, { data: targetData }, { data: incomingData }, { data: outgoingData }, { data: lotsData }] = await Promise.all([
    supabase.from('products').select('*').order('id'),
    supabase.from('sales_targets').select('target_amount').eq('month', to.slice(0, 7)).maybeSingle(),
    supabase.from('incoming_stock').select('product_id, quantity, received_at').not('received_at', 'is', null).gte('received_at', fromTs).lte('received_at', toTs),
    supabase.from('outgoing_stock').select('product_id, quantity, shipped_at').not('shipped_at', 'is', null).gte('shipped_at', fromTs).lte('shipped_at', toTs),
    supabase.from('lots').select('product_id, quantity'),
  ]);

  const products = (productsData ?? []) as Product[];
  const incomings = (incomingData ?? []) as IncomingRow[];
  const outgoings = (outgoingData ?? []) as OutgoingRow[];
  const lots = (lotsData ?? []) as { product_id: number; quantity: number }[];
  const feeMap = Object.fromEntries(products.map((p) => [p.id, {
    inc: p.incoming_fee_per_piece,
    sto: p.storage_fee_per_piece,
    out: p.outgoing_fee_per_piece,
  }]));
  const hasFeeConfig = products.some((p) => p.incoming_fee_per_piece != null || p.storage_fee_per_piece != null || p.outgoing_fee_per_piece != null);
  const priceMap = Object.fromEntries(products.map((p) => [p.id, p.price]));
  const nameMap = Object.fromEntries(products.map((p) => [p.id, p.name]));
  const hasRevenue = products.some((p) => p.price != null);

  const byProduct: Record<number, { units: number; revenue: number }> = {};
  for (const o of outgoings) {
    if (!byProduct[o.product_id]) byProduct[o.product_id] = { units: 0, revenue: 0 };
    byProduct[o.product_id].units += o.quantity;
    const price = priceMap[o.product_id];
    byProduct[o.product_id].revenue += price != null ? o.quantity * price : 0;
  }

  const totalUnits = Object.values(byProduct).reduce((s, v) => s + v.units, 0);
  const totalRevenue = hasRevenue ? Object.values(byProduct).reduce((s, v) => s + v.revenue, 0) : null;

  const allDates: string[] = [];
  const cursor = new Date(from + 'T00:00:00');
  const end = new Date(to + 'T00:00:00');
  while (cursor <= end) {
    allDates.push(cursor.toISOString().split('T')[0]);
    cursor.setDate(cursor.getDate() + 1);
  }

  const salesByDate: Record<string, { units: number; revenue: number }> = {};
  for (const o of outgoings) {
    const d = o.shipped_at.slice(0, 10);
    if (!salesByDate[d]) salesByDate[d] = { units: 0, revenue: 0 };
    salesByDate[d].units += o.quantity;
    const price = priceMap[o.product_id];
    salesByDate[d].revenue += price != null ? o.quantity * price : 0;
  }

  // Logistics cost per day
  const storageFeePerDay = lots.reduce((sum, l) => sum + l.quantity * (feeMap[l.product_id]?.sto ?? 0), 0);
  const logisticsByDate: Record<string, { incoming: number; storage: number; outgoing: number }> = {};
  for (const d of allDates) logisticsByDate[d] = { incoming: 0, storage: storageFeePerDay, outgoing: 0 };
  for (const row of incomings) {
    const d = row.received_at.slice(0, 10);
    if (logisticsByDate[d]) logisticsByDate[d].incoming += row.quantity * (feeMap[row.product_id]?.inc ?? 0);
  }
  for (const row of outgoings) {
    const d = row.shipped_at.slice(0, 10);
    if (logisticsByDate[d]) logisticsByDate[d].outgoing += row.quantity * (feeMap[row.product_id]?.out ?? 0);
  }
  const totalIncomingFee = Object.values(logisticsByDate).reduce((s, v) => s + v.incoming, 0);
  const totalStorageFee = Object.values(logisticsByDate).reduce((s, v) => s + v.storage, 0);
  const totalOutgoingFee = Object.values(logisticsByDate).reduce((s, v) => s + v.outgoing, 0);
  const totalLogisticsCost = totalIncomingFee + totalStorageFee + totalOutgoingFee;

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

  const periods = [
    { value: '7', label: t('report.period7', lang), href: '/sales/report?period=7' },
    { value: '30', label: t('report.period30', lang), href: '/sales/report?period=30' },
    { value: 'month', label: t('report.thisMonth', lang), href: `/sales/report?month=${new Date().toISOString().slice(0, 7)}` },
  ];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <Link href="/sales" className="text-xs text-slate-400 hover:text-slate-600">{t('report.backToSales', lang)}</Link>
          </div>
          <h1 className="text-xl font-bold text-slate-800">{t('report.title', lang)}</h1>
          <p className="text-sm text-slate-500">{label}</p>
        </div>
        <div className="flex gap-1 text-xs">
          {periods.map(({ value, label: l, href }) => {
            const active = value === 'month' ? !!month : !month && (period === value);
            return (
              <Link
                key={value}
                href={href}
                className={`px-3 py-1.5 rounded-lg transition-colors ${active ? 'bg-green-700 text-white font-medium' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
              >
                {l}
              </Link>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
          <p className="text-xs text-slate-500">{t('report.totalUnits', lang)}</p>
          <p className="text-3xl font-bold text-slate-700 mt-1">{totalUnits.toLocaleString()}</p>
        </div>
        {totalRevenue != null ? (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
            <p className="text-xs text-slate-500">{t('report.totalRevenue', lang)}</p>
            <p className="text-3xl font-bold text-green-700 mt-1">{totalRevenue.toLocaleString()}</p>
          </div>
        ) : (
          <div className="bg-slate-50 rounded-xl border border-slate-200 p-4 flex items-center">
            <p className="text-xs text-slate-400">{t('report.noRevenueHint', lang)}</p>
          </div>
        )}
        {dailyAvgRevenue != null && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
            <p className="text-xs text-slate-500">{t('report.dailyAvg', lang)}</p>
            <p className="text-3xl font-bold text-slate-700 mt-1">{Math.round(dailyAvgRevenue).toLocaleString()}</p>
          </div>
        )}
        {achievementPct !== null && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
            <p className="text-xs text-slate-500">{t('report.monthlyTarget', lang)}</p>
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

      <SalesReportCharts trend={trend} hasRevenue={hasRevenue} />

      {sortedProducts.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100">
            <h2 className="text-sm font-semibold text-slate-600">{t('report.byProduct', lang)}</h2>
          </div>
          <div className="divide-y divide-slate-100">
            {sortedProducts.map((p, i) => (
              <div key={p.id} className="flex items-center gap-3 px-4 py-3">
                <span className="text-sm font-bold text-slate-300 w-5 shrink-0">{i + 1}</span>
                <span className="flex-1 text-sm font-medium text-slate-800 truncate">{p.name}</span>
                <span className="text-sm text-slate-500 shrink-0">{p.units.toLocaleString()} {t('report.units', lang)}</span>
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

      {hasFeeConfig && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-600">{t('report.logisticsCost', lang)}</h2>
            <div className="flex gap-4 text-xs text-slate-500">
              <span>{t('report.incomingFeeTotal', lang)}: <strong className="text-slate-700">{Math.round(totalIncomingFee).toLocaleString()}</strong></span>
              <span>{t('report.storageFeeTotal', lang)}: <strong className="text-slate-700">{Math.round(totalStorageFee).toLocaleString()}</strong></span>
              <span>{t('report.outgoingFeeTotal', lang)}: <strong className="text-slate-700">{Math.round(totalOutgoingFee).toLocaleString()}</strong></span>
              <span className="font-semibold text-slate-800">{t('report.totalLogisticsCost', lang)}: <strong className="text-green-700">{Math.round(totalLogisticsCost).toLocaleString()}</strong></span>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-2 text-left text-slate-500 font-medium">日付</th>
                  <th className="px-4 py-2 text-right text-slate-500 font-medium">{t('report.incomingFeeTotal', lang)}</th>
                  <th className="px-4 py-2 text-right text-slate-500 font-medium">{t('report.storageFeeTotal', lang)}</th>
                  <th className="px-4 py-2 text-right text-slate-500 font-medium">{t('report.outgoingFeeTotal', lang)}</th>
                  <th className="px-4 py-2 text-right text-slate-500 font-medium">{t('report.totalLogisticsCost', lang)}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {[...allDates].reverse().map((d) => {
                  const row = logisticsByDate[d];
                  const total = row.incoming + row.storage + row.outgoing;
                  return (
                    <tr key={d} className="hover:bg-slate-50">
                      <td className="px-4 py-2 text-slate-700">{formatDate(d)}</td>
                      <td className="px-4 py-2 text-right text-slate-600">{row.incoming > 0 ? Math.round(row.incoming).toLocaleString() : '—'}</td>
                      <td className="px-4 py-2 text-right text-slate-600">{row.storage > 0 ? Math.round(row.storage).toLocaleString() : '—'}</td>
                      <td className="px-4 py-2 text-right text-slate-600">{row.outgoing > 0 ? Math.round(row.outgoing).toLocaleString() : '—'}</td>
                      <td className="px-4 py-2 text-right font-semibold text-slate-700">{total > 0 ? Math.round(total).toLocaleString() : '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="px-4 py-2 text-xs text-slate-400 border-t border-slate-100">{t('report.storageNote', lang)}</p>
        </div>
      )}

      {hasRevenue && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
          <h2 className="text-sm font-semibold text-slate-600 mb-3">
            {(dict['report.setTarget'] as (m: string) => string)(currentMonth)}
          </h2>
          <TargetForm month={currentMonth} currentTarget={typeof target === 'number' ? target : null} />
        </div>
      )}

      {outgoings.length === 0 && (
        <div className="text-center py-12 text-slate-400">
          <p>{t('report.noData', lang)}</p>
          <Link href="/sales" className="text-sm text-green-700 hover:underline mt-1 block">{t('report.goToSales', lang)}</Link>
        </div>
      )}
    </div>
  );
}
