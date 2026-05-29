import { createClient } from '@/lib/supabase';
import { getLang } from '@/lib/lang';
import { t, tf } from '@/lib/i18n';
import type { ReceiptWithLines } from '@/lib/db';
import ReceivedHistoryList from '@/components/ReceivedHistoryList';
import type { UnitConfig } from '@/lib/units';

export const dynamic = 'force-dynamic';

const PAGE_SIZE = 20;

export default async function IncomingHistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; page?: string }>;
}) {
  const { date, page: pageParam } = await searchParams;
  const page = Math.max(0, parseInt(pageParam ?? '0', 10) || 0);
  const [supabase, lang] = await Promise.all([createClient(), getLang()]);

  let query = supabase
    .from('receipts')
    .select('*, receipt_lines(*)', { count: 'exact' })
    .eq('status', 'received')
    .order('received_at', { ascending: false });

  if (date) {
    const next = new Date(date);
    next.setDate(next.getDate() + 1);
    const nextStr = next.toISOString().split('T')[0];
    query = query.gte('received_at', date).lt('received_at', nextStr);
  }

  const [{ data, count }, { data: productsData }] = await Promise.all([
    query.range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1),
    supabase.from('products').select('id, pieces_per_ball, balls_per_case, cases_per_pallet'),
  ]);

  const receipts = (data ?? []) as ReceiptWithLines[];
  const totalCount = count ?? 0;
  const totalPages = Math.ceil(totalCount / PAGE_SIZE);
  const unitMap: Record<number, UnitConfig> = Object.fromEntries(
    (productsData ?? []).map((p: { id: number; pieces_per_ball: number | null; balls_per_case: number | null; cases_per_pallet: number | null }) => [p.id, { pieces_per_ball: p.pieces_per_ball, balls_per_case: p.balls_per_case, cases_per_pallet: p.cases_per_pallet }])
  );

  const buildUrl = (p: number) => {
    const params = new URLSearchParams();
    if (date) params.set('date', date);
    if (p > 0) params.set('page', String(p));
    const qs = params.toString();
    return `/incoming/history${qs ? `?${qs}` : ''}`;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-800 mb-1">{t('incoming.historyTitle', lang)}</h1>
        <p className="text-sm text-slate-500">{t('incoming.historySubtitle', lang)}</p>
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
          {t('common.search', lang)}
        </button>
        {date && (
          <a href="/incoming/history"
            className="px-4 py-2 text-slate-500 text-sm rounded-lg hover:bg-slate-100 transition-colors shrink-0 flex items-center">
            {t('common.clearSearch', lang)}
          </a>
        )}
      </form>

      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs text-slate-400">
            {tf<string>('common.totalCount', lang, totalCount)}
            {totalPages > 1 && (
              <span className="ml-2">{tf<string>('common.pageOf', lang, page + 1, totalPages)}</span>
            )}
          </p>
        </div>

        <ReceivedHistoryList receipts={receipts} emptyText={t('incoming.historyEmpty', lang)} unitMap={unitMap} />

        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-3 mt-4">
            {page > 0 ? (
              <a href={buildUrl(page - 1)}
                className="px-4 py-2 text-sm text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors">
                {t('common.prevPage', lang)}
              </a>
            ) : (
              <span className="px-4 py-2 text-sm text-slate-300 border border-slate-200 rounded-lg">
                {t('common.prevPage', lang)}
              </span>
            )}
            <span className="text-xs text-slate-500">{tf<string>('common.pageOf', lang, page + 1, totalPages)}</span>
            {page < totalPages - 1 ? (
              <a href={buildUrl(page + 1)}
                className="px-4 py-2 text-sm text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors">
                {t('common.nextPage', lang)}
              </a>
            ) : (
              <span className="px-4 py-2 text-sm text-slate-300 border border-slate-200 rounded-lg">
                {t('common.nextPage', lang)}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
