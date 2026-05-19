import { createClient } from '@/lib/supabase';
import { getLang } from '@/lib/lang';
import { t } from '@/lib/i18n';
import type { IncomingStock } from '@/lib/db';
import ReceivedHistoryList from '@/components/ReceivedHistoryList';
import type { UnitConfig } from '@/lib/units';

export const dynamic = 'force-dynamic';

export default async function IncomingHistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const { date } = await searchParams;
  const [supabase, lang] = await Promise.all([createClient(), getLang()]);

  let query = supabase.from('incoming_stock').select('*').not('received_at', 'is', null);

  if (date) {
    const next = new Date(date);
    next.setDate(next.getDate() + 1);
    const nextStr = next.toISOString().split('T')[0];
    query = query.gte('received_at', date).lt('received_at', nextStr).order('received_at', { ascending: false });
  } else {
    query = query.order('received_at', { ascending: false }).limit(60);
  }

  const [{ data }, { data: productsData }] = await Promise.all([
    query,
    supabase.from('products').select('id, pieces_per_ball, balls_per_case, cases_per_pallet'),
  ]);
  const items = (data ?? []) as IncomingStock[];
  const unitMap: Record<number, UnitConfig> = Object.fromEntries(
    (productsData ?? []).map((p: { id: number; pieces_per_ball: number | null; balls_per_case: number | null; cases_per_pallet: number | null }) => [p.id, { pieces_per_ball: p.pieces_per_ball, balls_per_case: p.balls_per_case, cases_per_pallet: p.cases_per_pallet }])
  );

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
        <p className="text-xs text-slate-400 mb-2">
          {date ? `${t('incoming.receivedDate', lang)}: ${date}` : t('incoming.recentReceived', lang)}
        </p>
        <ReceivedHistoryList items={items} emptyText={t('incoming.historyEmpty', lang)} unitMap={unitMap} />
      </div>
    </div>
  );
}
