import { createClient } from '@/lib/supabase';
import { getLang } from '@/lib/lang';
import { t } from '@/lib/i18n';
import type { Product, IncomingStock } from '@/lib/db';
import IncomingScheduleForm from '@/components/IncomingScheduleForm';
import IncomingScheduleList from '@/components/IncomingScheduleList';

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
    supabase.from('products').select('id, name').order('id'),
  ]);
  const pending = (pendingData ?? []) as IncomingStock[];
  const products = (productsData ?? []) as Pick<Product, 'id' | 'name'>[];

  const today = new Date().toISOString().split('T')[0];

  return (
    <div>
      <h1 className="text-xl font-bold text-slate-800 mb-1">{t('incoming.scheduleTitle', lang)}</h1>
      <p className="text-sm text-slate-500 mb-4">{t('incoming.scheduleSubtitle', lang)}</p>

      <div className="mb-6">
        <IncomingScheduleList items={pending} emptyText={t('incoming.noScheduled', lang)} />
      </div>

      <div className="bg-white rounded-xl border border-dashed border-slate-300 p-4">
        <h2 className="text-sm font-semibold text-slate-600 mb-3">{t('incoming.addSchedule', lang)}</h2>
        <IncomingScheduleForm products={products} today={today} />
      </div>
    </div>
  );
}
