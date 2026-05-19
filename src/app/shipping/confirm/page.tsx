import { createClient } from '@/lib/supabase';
import { getLang } from '@/lib/lang';
import { t } from '@/lib/i18n';
import type { OutgoingStock } from '@/lib/db';
import OutgoingConfirmList from '@/components/OutgoingConfirmList';
import ShippedHistoryList from '@/components/ShippedHistoryList';
import type { UnitConfig } from '@/lib/units';

export const dynamic = 'force-dynamic';

export default async function ShippingConfirmPage() {
  const [supabase, lang] = await Promise.all([createClient(), getLang()]);
  const [{ data: pendingData }, { data: shippedData }, { data: productsData }] = await Promise.all([
    supabase.from('outgoing_stock').select('*').is('shipped_at', null).order('scheduled_date').order('id'),
    supabase.from('outgoing_stock').select('*').not('shipped_at', 'is', null).order('shipped_at', { ascending: false }).limit(60),
    supabase.from('products').select('id, pieces_per_ball, balls_per_case, cases_per_pallet'),
  ]);
  const pending = (pendingData ?? []) as OutgoingStock[];
  const shipped = (shippedData ?? []) as OutgoingStock[];
  const unitMap: Record<number, UnitConfig> = Object.fromEntries(
    (productsData ?? []).map((p: { id: number; pieces_per_ball: number | null; balls_per_case: number | null; cases_per_pallet: number | null }) => [p.id, { pieces_per_ball: p.pieces_per_ball, balls_per_case: p.balls_per_case, cases_per_pallet: p.cases_per_pallet }])
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-800 mb-1">{t('shipping.confirmTitle', lang)}</h1>
        <p className="text-sm text-slate-500">{t('shipping.confirmSubtitle', lang)}</p>
      </div>

      <div>
        <h2 className="text-sm font-semibold text-slate-600 mb-2">{t('shipping.pending', lang)}</h2>
        <OutgoingConfirmList items={pending} emptyText={t('shipping.noPending', lang)} unitMap={unitMap} />
      </div>

      <div>
        <h2 className="text-sm font-semibold text-slate-600 mb-2">{t('shipping.recentShipped', lang)}</h2>
        <ShippedHistoryList items={shipped} emptyText={t('shipping.noPending', lang)} unitMap={unitMap} />
      </div>
    </div>
  );
}
