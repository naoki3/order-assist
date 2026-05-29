import { createClient } from '@/lib/supabase';
import { getLang } from '@/lib/lang';
import { t, tf } from '@/lib/i18n';
import type { ReceiptWithLines } from '@/lib/db';
import ReceivedHistoryList from '@/components/ReceivedHistoryList';
import type { UnitConfig } from '@/lib/units';

export const dynamic = 'force-dynamic';

const DATE_PAGE_SIZE = 50;

export default async function IncomingHistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; page?: string }>;
}) {
  const { date, page: pageParam } = await searchParams;
  const page = Math.max(0, parseInt(pageParam ?? '0', 10) || 0);
  const [supabase, lang] = await Promise.all([createClient(), getLang()]);

  let receipts: ReceiptWithLines[] = [];
  let totalDateCount = 0;
  let totalPages = 1;

  type ProductRow = { id: number; pieces_per_ball: number | null; balls_per_case: number | null; cases_per_pallet: number | null };

  if (date) {
    const next = new Date(date);
    next.setDate(next.getDate() + 1);
    const nextStr = next.toISOString().split('T')[0];
    const [{ data: receiptsData }, { data: productsData }] = await Promise.all([
      supabase.from('receipts')
        .select('*, receipt_lines(*)')
        .eq('status', 'received')
        .gte('received_at', date)
        .lt('received_at', nextStr)
        .order('received_at', { ascending: false }),
      supabase.from('products').select('id, pieces_per_ball, balls_per_case, cases_per_pallet'),
    ]);
    receipts = (receiptsData ?? []) as ReceiptWithLines[];
    const unitMap: Record<number, UnitConfig> = Object.fromEntries(
      (productsData ?? []).map((p: ProductRow) => [p.id, { pieces_per_ball: p.pieces_per_ball, balls_per_case: p.balls_per_case, cases_per_pallet: p.cases_per_pallet }])
    );
    return <HistoryView lang={lang} date={date} receipts={receipts} unitMap={unitMap} totalDateCount={0} totalPages={1} page={0} />;
  }

  // Date-based pagination: fetch all distinct dates first (lightweight)
  const [{ data: datesData }, { data: productsData }] = await Promise.all([
    supabase.from('receipts')
      .select('received_at')
      .eq('status', 'received')
      .order('received_at', { ascending: false }),
    supabase.from('products').select('id, pieces_per_ball, balls_per_case, cases_per_pallet'),
  ]);

  type DateRow = { received_at: string | null };
  const allDates = [...new Set(
    (datesData ?? []).map((r: DateRow) => r.received_at?.split('T')[0]).filter((d): d is string => !!d)
  )];

  totalDateCount = allDates.length;
  totalPages = Math.max(1, Math.ceil(totalDateCount / DATE_PAGE_SIZE));

  const pageDates = allDates.slice(page * DATE_PAGE_SIZE, (page + 1) * DATE_PAGE_SIZE);
  if (pageDates.length > 0) {
    const fromDate = pageDates[pageDates.length - 1];
    const toNext = new Date(pageDates[0]);
    toNext.setDate(toNext.getDate() + 1);
    const { data: receiptsData } = await supabase
      .from('receipts')
      .select('*, receipt_lines(*)')
      .eq('status', 'received')
      .gte('received_at', fromDate)
      .lt('received_at', toNext.toISOString().split('T')[0])
      .order('received_at', { ascending: false });
    receipts = (receiptsData ?? []) as ReceiptWithLines[];
  }

  const unitMap: Record<number, UnitConfig> = Object.fromEntries(
    (productsData ?? []).map((p: ProductRow) => [p.id, { pieces_per_ball: p.pieces_per_ball, balls_per_case: p.balls_per_case, cases_per_pallet: p.cases_per_pallet }])
  );

  return <HistoryView lang={lang} date={date} receipts={receipts} unitMap={unitMap} totalDateCount={totalDateCount} totalPages={totalPages} page={page} />;
}

function HistoryView({
  lang,
  date,
  receipts,
  unitMap,
  totalDateCount,
  totalPages,
  page,
}: {
  lang: string;
  date?: string;
  receipts: ReceiptWithLines[];
  unitMap: Record<number, UnitConfig>;
  totalDateCount: number;
  totalPages: number;
  page: number;
}) {
  const buildUrl = (p: number) => {
    const params = new URLSearchParams();
    if (p > 0) params.set('page', String(p));
    const qs = params.toString();
    return `/incoming/history${qs ? `?${qs}` : ''}`;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-800 mb-1">{t('incoming.historyTitle', lang as 'ja' | 'en')}</h1>
        <p className="text-sm text-slate-500">{t('incoming.historySubtitle', lang as 'ja' | 'en')}</p>
      </div>

      <form method="GET" className="flex gap-2">
        <input
          type="date"
          name="date"
          defaultValue={date ?? ''}
          className="flex-1 min-w-0 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
        />
        <button type="submit"
          className="px-4 py-2 bg-green-700 text-white text-sm rounded-lg hover:bg-green-800 transition-colors font-medium shrink-0">
          {t('common.search', lang as 'ja' | 'en')}
        </button>
        {date && (
          <a href="/incoming/history"
            className="px-4 py-2 text-slate-500 text-sm rounded-lg hover:bg-slate-100 transition-colors shrink-0 flex items-center">
            {t('common.clearSearch', lang as 'ja' | 'en')}
          </a>
        )}
      </form>

      <div>
        {!date && totalDateCount > 0 && (
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs text-slate-400">
              {`全 ${totalDateCount} 日分`}
              {totalPages > 1 && (
                <span className="ml-2">{tf<string>('common.pageOf', lang as 'ja' | 'en', page + 1, totalPages)}</span>
              )}
            </p>
          </div>
        )}

        <ReceivedHistoryList receipts={receipts} emptyText={t('incoming.historyEmpty', lang as 'ja' | 'en')} unitMap={unitMap} />

        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-3 mt-4">
            {page > 0 ? (
              <a href={buildUrl(page - 1)}
                className="px-4 py-2 text-sm text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors">
                {t('common.prevPage', lang as 'ja' | 'en')}
              </a>
            ) : (
              <span className="px-4 py-2 text-sm text-slate-300 border border-slate-200 rounded-lg">
                {t('common.prevPage', lang as 'ja' | 'en')}
              </span>
            )}
            <span className="text-xs text-slate-500">{tf<string>('common.pageOf', lang as 'ja' | 'en', page + 1, totalPages)}</span>
            {page < totalPages - 1 ? (
              <a href={buildUrl(page + 1)}
                className="px-4 py-2 text-sm text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors">
                {t('common.nextPage', lang as 'ja' | 'en')}
              </a>
            ) : (
              <span className="px-4 py-2 text-sm text-slate-300 border border-slate-200 rounded-lg">
                {t('common.nextPage', lang as 'ja' | 'en')}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
