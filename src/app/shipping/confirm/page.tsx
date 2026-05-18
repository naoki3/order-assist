import { createClient } from '@/lib/supabase';
import { getLang } from '@/lib/lang';
import { t } from '@/lib/i18n';
import type { OutgoingStock } from '@/lib/db';
import OutgoingConfirmList from '@/components/OutgoingConfirmList';

export const dynamic = 'force-dynamic';

export default async function ShippingConfirmPage() {
  const [supabase, lang] = await Promise.all([createClient(), getLang()]);
  const [{ data: pendingData }, { data: shippedData }] = await Promise.all([
    supabase
      .from('outgoing_stock')
      .select('*')
      .is('shipped_at', null)
      .order('scheduled_date')
      .order('id'),
    supabase
      .from('outgoing_stock')
      .select('*')
      .not('shipped_at', 'is', null)
      .order('shipped_at', { ascending: false })
      .limit(20),
  ]);
  const pending = (pendingData ?? []) as OutgoingStock[];
  const shipped = (shippedData ?? []) as OutgoingStock[];

  return (
    <div>
      <h1 className="text-xl font-bold text-slate-800 mb-1">{t('shipping.confirmTitle', lang)}</h1>
      <p className="text-sm text-slate-500 mb-4">{t('shipping.confirmSubtitle', lang)}</p>

      <h2 className="text-sm font-semibold text-slate-600 mb-2">{t('shipping.pending', lang)}</h2>
      <div className="mb-6">
        <OutgoingConfirmList items={pending} emptyText={t('shipping.noPending', lang)} />
      </div>

      {shipped.length > 0 && (
        <>
          <h2 className="text-sm font-semibold text-slate-600 mb-2">{t('shipping.recentShipped', lang)}</h2>
          <div className="space-y-2">
            {shipped.map((item) => (
              <div key={item.id} className="bg-slate-50 rounded-xl border border-slate-100 p-4 flex items-center justify-between gap-3 opacity-70">
                <div>
                  <p className="font-semibold text-slate-700">{item.product_name}</p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {item.quantity} {t('shipping.units', lang)} · {t('shipping.shippedDate', lang)} {item.shipped_at?.slice(0, 10)}
                  </p>
                </div>
                <span className="text-xs text-blue-600 font-medium">{t('shipping.confirmed', lang)}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
