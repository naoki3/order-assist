import { createClient } from '@/lib/supabase';
import { getLang } from '@/lib/lang';
import { t, tf } from '@/lib/i18n';
import type { ShipmentWithLines } from '@/lib/db';
import ShippedHistoryList from '@/components/ShippedHistoryList';
import type { UnitConfig } from '@/lib/units';

export const dynamic = 'force-dynamic';

const DATE_PAGE_SIZE = 50;

export default async function ShippingHistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; page?: string }>;
}) {
  const { date, page: pageParam } = await searchParams;
  const page = Math.max(0, parseInt(pageParam ?? '0', 10) || 0);
  const [supabase, lang] = await Promise.all([createClient(), getLang()]);

  let shipments: ShipmentWithLines[] = [];
  let totalDateCount = 0;
  let totalPages = 1;

  type ProductRow = { id: number; pieces_per_ball: number | null; balls_per_case: number | null; cases_per_pallet: number | null };

  if (date) {
    const next = new Date(date);
    next.setDate(next.getDate() + 1);
    const nextStr = next.toISOString().split('T')[0];
    const [{ data: shipmentsData }, { data: productsData }, { data: statusesData }] = await Promise.all([
      supabase.from('shipments')
        .select('*, shipment_lines(*)')
        .eq('status', 'shipped')
        .gte('shipped_at', date)
        .lt('shipped_at', nextStr)
        .order('shipped_at', { ascending: false }),
      supabase.from('products').select('id, pieces_per_ball, balls_per_case, cases_per_pallet'),
      supabase.from('inventory_statuses').select('id, name, color').order('name'),
    ]);
    shipments = (shipmentsData ?? []) as ShipmentWithLines[];
    const unitMap: Record<number, UnitConfig> = Object.fromEntries(
      (productsData ?? []).map((p: ProductRow) => [p.id, { pieces_per_ball: p.pieces_per_ball, balls_per_case: p.balls_per_case, cases_per_pallet: p.cases_per_pallet }])
    );
    const statuses = (statusesData ?? []) as { id: number; name: string; color: string }[];
    return <HistoryView lang={lang} date={date} shipments={shipments} unitMap={unitMap} statuses={statuses} totalDateCount={0} totalPages={1} page={0} />;
  }

  // Date-based pagination: fetch all distinct dates first (lightweight)
  const [{ data: datesData }, { data: productsData }, { data: statusesData }] = await Promise.all([
    supabase.from('shipments')
      .select('shipped_at')
      .eq('status', 'shipped')
      .order('shipped_at', { ascending: false }),
    supabase.from('products').select('id, pieces_per_ball, balls_per_case, cases_per_pallet'),
    supabase.from('inventory_statuses').select('id, name, color').order('name'),
  ]);

  type DateRow = { shipped_at: string | null };
  const allDates = [...new Set(
    (datesData ?? []).map((r: DateRow) => r.shipped_at?.split('T')[0]).filter((d): d is string => !!d)
  )];

  totalDateCount = allDates.length;
  totalPages = Math.max(1, Math.ceil(totalDateCount / DATE_PAGE_SIZE));

  const pageDates = allDates.slice(page * DATE_PAGE_SIZE, (page + 1) * DATE_PAGE_SIZE);
  if (pageDates.length > 0) {
    const fromDate = pageDates[pageDates.length - 1];
    const toNext = new Date(pageDates[0]);
    toNext.setDate(toNext.getDate() + 1);
    const { data: shipmentsData } = await supabase
      .from('shipments')
      .select('*, shipment_lines(*)')
      .eq('status', 'shipped')
      .gte('shipped_at', fromDate)
      .lt('shipped_at', toNext.toISOString().split('T')[0])
      .order('shipped_at', { ascending: false });
    shipments = (shipmentsData ?? []) as ShipmentWithLines[];
  }

  const unitMap: Record<number, UnitConfig> = Object.fromEntries(
    (productsData ?? []).map((p: ProductRow) => [p.id, { pieces_per_ball: p.pieces_per_ball, balls_per_case: p.balls_per_case, cases_per_pallet: p.cases_per_pallet }])
  );
  const statuses = (statusesData ?? []) as { id: number; name: string; color: string }[];

  return <HistoryView lang={lang} date={date} shipments={shipments} unitMap={unitMap} statuses={statuses} totalDateCount={totalDateCount} totalPages={totalPages} page={page} />;
}

function HistoryView({
  lang,
  date,
  shipments,
  unitMap,
  statuses,
  totalDateCount,
  totalPages,
  page,
}: {
  lang: string;
  date?: string;
  shipments: ShipmentWithLines[];
  unitMap: Record<number, UnitConfig>;
  statuses: { id: number; name: string; color: string }[];
  totalDateCount: number;
  totalPages: number;
  page: number;
}) {
  const l = lang as 'ja' | 'en';
  const buildUrl = (p: number) => {
    const params = new URLSearchParams();
    if (p > 0) params.set('page', String(p));
    const qs = params.toString();
    return `/shipping/history${qs ? `?${qs}` : ''}`;
  };

  return (
    <div className="space-y-6">
      <div className="print:hidden">
        <h1 className="text-xl font-bold text-slate-800 mb-1">{t('shipping.historyTitle', l)}</h1>
        <p className="text-sm text-slate-500">{t('shipping.historySubtitle', l)}</p>
      </div>

      <form method="GET" className="flex gap-2 print:hidden">
        <input
          type="date"
          name="date"
          defaultValue={date ?? ''}
          className="flex-1 min-w-0 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
        />
        <button type="submit"
          className="px-4 py-2 bg-green-700 text-white text-sm rounded-lg hover:bg-green-800 transition-colors font-medium shrink-0">
          {t('common.search', l)}
        </button>
        {date && (
          <a href="/shipping/history"
            className="px-4 py-2 text-slate-500 text-sm rounded-lg hover:bg-slate-100 transition-colors shrink-0 flex items-center">
            {t('common.clearSearch', l)}
          </a>
        )}
      </form>

      <div>
        {!date && totalDateCount > 0 && (
          <div className="flex items-center justify-between mb-2 print:hidden">
            <p className="text-xs text-slate-400">
              {`全 ${totalDateCount} 日分`}
              {totalPages > 1 && (
                <span className="ml-2">{tf<string>('common.pageOf', l, page + 1, totalPages)}</span>
              )}
            </p>
          </div>
        )}
        {date && (
          <p className="text-xs text-slate-400 mb-2 print:hidden">
            {`${t('shipping.shippedDate', l)}: ${date}`}
          </p>
        )}

        <ShippedHistoryList shipments={shipments} emptyText={t('shipping.historyEmpty', l)} unitMap={unitMap} statuses={statuses} />

        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-3 mt-4 print:hidden">
            {page > 0 ? (
              <a href={buildUrl(page - 1)}
                className="px-4 py-2 text-sm text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors">
                {t('common.prevPage', l)}
              </a>
            ) : (
              <span className="px-4 py-2 text-sm text-slate-300 border border-slate-200 rounded-lg">
                {t('common.prevPage', l)}
              </span>
            )}
            <span className="text-xs text-slate-500">{tf<string>('common.pageOf', l, page + 1, totalPages)}</span>
            {page < totalPages - 1 ? (
              <a href={buildUrl(page + 1)}
                className="px-4 py-2 text-sm text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors">
                {t('common.nextPage', l)}
              </a>
            ) : (
              <span className="px-4 py-2 text-sm text-slate-300 border border-slate-200 rounded-lg">
                {t('common.nextPage', l)}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
