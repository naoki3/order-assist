import { createClient } from '@/lib/supabase';
import { getLang } from '@/lib/lang';
import { t } from '@/lib/i18n';
import type { IncomingStock } from '@/lib/db';
import IncomingScheduleList from '@/components/IncomingScheduleList';
import IncomingCsvImport from '@/components/IncomingCsvImport';

export const dynamic = 'force-dynamic';

export default async function IncomingSchedulePage() {
  const [supabase, lang] = await Promise.all([createClient(), getLang()]);
  const [{ data: pendingData }, { data: productsData }] = await Promise.all([
    supabase
      .from('incoming_stock')
      .select('*')
      .is('received_at', null)
      .order('expected_date')
      .order('id'),
    supabase.from('products').select('id, name, pieces_per_ball, balls_per_case, cases_per_pallet').order('id'),
  ]);
  const pending = (pendingData ?? []) as IncomingStock[];
  const products = (productsData ?? []) as { id: number; name: string; pieces_per_ball: number | null; balls_per_case: number | null; cases_per_pallet: number | null }[];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-800 mb-1">{t('incoming.scheduleTitle', lang)}</h1>
        <p className="text-sm text-slate-500">{t('incoming.scheduleSubtitle', lang)}</p>
      </div>

      <IncomingScheduleList items={pending} emptyText={t('incoming.noScheduled', lang)} products={products} />

      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <h2 className="text-sm font-semibold text-slate-600 mb-3">{t('incoming.importCsv', lang)}</h2>
        <div className="bg-slate-50 rounded-lg p-3 mb-4 text-xs text-slate-600 font-mono">
          <p className="font-sans font-semibold text-slate-500 mb-1.5">{t('incoming.csvFormat', lang)}</p>
          <p className="text-slate-400">商品名,数量,入荷予定日</p>
          <p>牛乳1L,10,2026-05-20</p>
          <p>食パン,5,2026-05-21</p>
        </div>
        <div className="text-xs text-slate-400 space-y-0.5 mb-4">
          <p>· {t('incoming.csvHint1', lang)}</p>
          <p>· {t('incoming.csvHint2', lang)}</p>
          <p>· {t('incoming.csvHint3', lang)}</p>
          <p>· {t('incoming.csvHint4', lang)}</p>
        </div>
        <IncomingCsvImport />
      </div>
    </div>
  );
}
