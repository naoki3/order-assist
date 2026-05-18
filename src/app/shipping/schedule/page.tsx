import { createClient } from '@/lib/supabase';
import { getLang } from '@/lib/lang';
import { t } from '@/lib/i18n';
import type { Product, OutgoingStock } from '@/lib/db';
import OutgoingScheduleForm from '@/components/OutgoingScheduleForm';
import DeleteOutgoingButton from '@/components/DeleteOutgoingButton';
import OutgoingCsvImport from '@/components/OutgoingCsvImport';

export const dynamic = 'force-dynamic';

export default async function ShippingSchedulePage() {
  const [supabase, lang] = await Promise.all([createClient(), getLang()]);
  const [{ data: pendingData }, { data: productsData }] = await Promise.all([
    supabase
      .from('outgoing_stock')
      .select('*')
      .is('shipped_at', null)
      .order('scheduled_date')
      .order('id'),
    supabase.from('products').select('id, name').order('id'),
  ]);
  const pending = (pendingData ?? []) as OutgoingStock[];
  const products = (productsData ?? []) as Pick<Product, 'id' | 'name'>[];

  const today = new Date().toISOString().split('T')[0];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-800 mb-1">{t('shipping.scheduleTitle', lang)}</h1>
        <p className="text-sm text-slate-500">{t('shipping.scheduleSubtitle', lang)}</p>
      </div>

      {/* Pending list */}
      {pending.length === 0 ? (
        <p className="text-slate-400 text-sm">{t('shipping.noScheduled', lang)}</p>
      ) : (
        <div className="space-y-2">
          {pending.map((item) => (
            <div key={item.id} className="bg-white rounded-xl border border-slate-200 p-4 flex items-center justify-between gap-3">
              <div>
                <p className="font-semibold text-slate-800">{item.product_name}</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  {item.quantity} {t('shipping.units', lang)} · {t('shipping.scheduledDate', lang)} {item.scheduled_date}
                  {item.note && <span className="text-slate-400"> · {item.note}</span>}
                </p>
              </div>
              <DeleteOutgoingButton id={item.id} />
            </div>
          ))}
        </div>
      )}

      {/* Manual add form */}
      <div className="bg-white rounded-xl border border-dashed border-slate-300 p-4">
        <h2 className="text-sm font-semibold text-slate-600 mb-3">{t('shipping.addSchedule', lang)}</h2>
        <OutgoingScheduleForm products={products} today={today} />
      </div>

      {/* CSV import */}
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <h2 className="text-sm font-semibold text-slate-600 mb-3">{t('shipping.importCsv', lang)}</h2>

        {/* Format example */}
        <div className="bg-slate-50 rounded-lg p-3 mb-4 text-xs text-slate-600 font-mono">
          <p className="font-sans font-semibold text-slate-500 mb-1.5">{t('shipping.csvFormat', lang)}</p>
          <p className="text-slate-400">商品名,数量,出荷予定日,備考</p>
          <p>牛乳1L,10,2026-05-20,A店向け</p>
          <p>食パン,5,2026-05-20</p>
          <p>卵（10個入）,20,2026-05-21,B店向け</p>
        </div>
        <div className="text-xs text-slate-400 space-y-0.5 mb-4">
          <p>· {t('shipping.csvHint1', lang)}</p>
          <p>· {t('shipping.csvHint2', lang)}</p>
          <p>· {t('shipping.csvHint3', lang)}</p>
          <p>· {t('shipping.csvHint4', lang)}</p>
        </div>

        <OutgoingCsvImport />
      </div>
    </div>
  );
}
