import { createClient } from '@/lib/supabase';
import { getLang, getTz } from '@/lib/lang';
import { t } from '@/lib/i18n';
import type { OrderHistoryItem } from '@/lib/db';
import type { OrderItem } from '@/lib/actions';
import { formatQty } from '@/lib/units';
import type { UnitConfig } from '@/lib/units';

export const dynamic = 'force-dynamic';

export default async function HistoryPage() {
  const [supabase, lang, tz] = await Promise.all([createClient(), getLang(), getTz()]);
  const [{ data }, { data: productsData }] = await Promise.all([
    supabase.from('order_history').select('*').order('created_at', { ascending: false }).limit(50),
    supabase.from('products').select('id, pieces_per_ball, balls_per_case, cases_per_pallet'),
  ]);
  const orders = (data ?? []) as OrderHistoryItem[];
  const unitMap: Record<number, UnitConfig> = Object.fromEntries(
    ((productsData ?? []) as { id: number; pieces_per_ball: number | null; balls_per_case: number | null; cases_per_pallet: number | null }[])
      .map((p) => [p.id, { pieces_per_ball: p.pieces_per_ball, balls_per_case: p.balls_per_case, cases_per_pallet: p.cases_per_pallet }])
  );

  function formatDate(iso: string): string {
    return new Intl.DateTimeFormat('ja-JP', {
      timeZone: tz,
      year: 'numeric', month: 'numeric', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    }).format(new Date(iso));
  }

  function parseItems(raw: unknown): OrderItem[] {
    try {
      const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  return (
    <div>
      <h1 className="text-xl font-bold text-slate-800 mb-4">{t('history.title', lang)}</h1>

      {orders.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <p>{t('history.noHistory', lang)}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map((order) => {
            const items = parseItems(order.items);
            const expectedDates = [...new Set(items.map(i => i.expectedDate).filter(Boolean))];
            return (
              <div key={order.id} className="bg-white rounded-xl border border-slate-200 p-4">
                <div className="flex items-baseline justify-between mb-2">
                  <p className="text-xs text-slate-400">{t('history.orderedAt', lang)}{formatDate(order.created_at)}</p>
                  {expectedDates.length > 0 && (
                    <p className="text-xs font-medium text-slate-600">{t('history.expectedDate', lang)}{expectedDates.join(', ')}</p>
                  )}
                </div>
                <div className="space-y-1">
                  {items.length > 0 ? items.map((item, i) => {
                    const uc = item.productId != null ? (unitMap[item.productId] ?? { pieces_per_ball: null, balls_per_case: null, cases_per_pallet: null }) : { pieces_per_ball: null, balls_per_case: null, cases_per_pallet: null };
                    const qtyStr = uc.pieces_per_ball ? formatQty(item.quantity, uc, lang) : `${item.quantity} ${t('history.units', lang)}`;
                    return (
                    <div key={item.productId ?? i} className="flex justify-between text-sm">
                      <span className="text-slate-700">{item.productName}</span>
                      <span className="font-semibold text-slate-800">{qtyStr}</span>
                    </div>
                    );
                  }) : (
                    <p className="text-xs text-slate-400">{t('history.noDetails', lang)}</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
