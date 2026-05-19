import { createClient } from '@/lib/supabase';
import { getLang, getTz } from '@/lib/lang';
import { t } from '@/lib/i18n';
import type { OrderHistoryItem } from '@/lib/db';
import type { OrderItem } from '@/lib/actions';

export const dynamic = 'force-dynamic';

export default async function HistoryPage() {
  const [supabase, lang, tz] = await Promise.all([createClient(), getLang(), getTz()]);
  const { data } = await supabase
    .from('order_history')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50);
  const orders = (data ?? []) as OrderHistoryItem[];

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
            return (
              <div key={order.id} className="bg-white rounded-xl border border-slate-200 p-4">
                <p className="text-xs text-slate-400 mb-2">{formatDate(order.created_at)}</p>
                <div className="space-y-1">
                  {items.map((item, i) => (
                    <div key={item.productId ?? i} className="flex justify-between text-sm">
                      <span className="text-slate-700">{item.productName}</span>
                      <div className="text-right">
                        <span className="font-semibold text-slate-800">{item.quantity} {t('history.units', lang)}</span>
                        {item.expectedDate && (
                          <span className="text-xs text-slate-400 ml-2">{item.expectedDate}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
