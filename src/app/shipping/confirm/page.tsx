import { createClient } from '@/lib/supabase';
import { getLang } from '@/lib/lang';
import { t } from '@/lib/i18n';
import type { OutgoingStock } from '@/lib/db';
import OutgoingConfirmList from '@/components/OutgoingConfirmList';
import ShippedHistoryList from '@/components/ShippedHistoryList';

export const dynamic = 'force-dynamic';

export default async function ShippingConfirmPage() {
  const [supabase, lang] = await Promise.all([createClient(), getLang()]);
  const [{ data: pendingData }, { data: shippedData }] = await Promise.all([
    supabase.from('outgoing_stock').select('*').is('shipped_at', null).order('scheduled_date').order('id'),
    supabase.from('outgoing_stock').select('*').not('shipped_at', 'is', null).order('shipped_at', { ascending: false }).limit(60),
  ]);
  const pending = (pendingData ?? []) as OutgoingStock[];
  const shipped = (shippedData ?? []) as OutgoingStock[];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-800 mb-1">{t('shipping.confirmTitle', lang)}</h1>
        <p className="text-sm text-slate-500">{t('shipping.confirmSubtitle', lang)}</p>
      </div>

      <div>
        <h2 className="text-sm font-semibold text-slate-600 mb-2">{t('shipping.pending', lang)}</h2>
        <OutgoingConfirmList items={pending} emptyText={t('shipping.noPending', lang)} />
      </div>

      <div>
        <h2 className="text-sm font-semibold text-slate-600 mb-2">{t('shipping.recentShipped', lang)}</h2>
        <ShippedHistoryList items={shipped} emptyText={t('shipping.noPending', lang)} />
      </div>
    </div>
  );
}
