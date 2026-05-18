import { createClient } from '@/lib/supabase';
import { getLang } from '@/lib/lang';
import { t } from '@/lib/i18n';
import type { Product, IncomingStock } from '@/lib/db';
import IncomingScheduleForm from '@/components/IncomingScheduleForm';
import DeleteIncomingButton from '@/components/DeleteIncomingButton';

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

      {pending.length === 0 ? (
        <p className="text-slate-400 text-sm mb-6">{t('incoming.noScheduled', lang)}</p>
      ) : (
        <div className="space-y-2 mb-6">
          {pending.map((item) => (
            <div key={item.id} className="bg-white rounded-xl border border-slate-200 p-4 flex items-center justify-between gap-3">
              <div>
                <p className="font-semibold text-slate-800">{item.product_name}</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  {item.quantity} {t('incoming.units', lang)} · {t('incoming.expectedLabel2', lang)} {item.expected_date}
                </p>
              </div>
              <DeleteIncomingButton id={item.id} />
            </div>
          ))}
        </div>
      )}

      <div className="bg-white rounded-xl border border-dashed border-slate-300 p-4">
        <h2 className="text-sm font-semibold text-slate-600 mb-3">{t('incoming.addSchedule', lang)}</h2>
        <IncomingScheduleForm products={products} today={today} />
      </div>
    </div>
  );
}
