import { createClient } from '@/lib/supabase';
import { getLang } from '@/lib/lang';
import { t } from '@/lib/i18n';
import type { Product, Inventory, IncomingStock } from '@/lib/db';

export const dynamic = 'force-dynamic';

export default async function InventoryPage() {
  const [supabase, lang] = await Promise.all([createClient(), getLang()]);
  const [{ data: productsData }, { data: inventoriesData }, { data: incomingData }] = await Promise.all([
    supabase.from('products').select('*').order('id'),
    supabase.from('inventory').select('*'),
    supabase
      .from('incoming_stock')
      .select('product_id, received_at, expiry_date')
      .not('received_at', 'is', null)
      .order('received_at', { ascending: false }),
  ]);
  const products = (productsData ?? []) as Product[];
  const inventories = (inventoriesData ?? []) as Inventory[];
  const incoming = (incomingData ?? []) as Pick<IncomingStock, 'product_id' | 'received_at' | 'expiry_date'>[];

  const stockMap = Object.fromEntries(inventories.map((i) => [i.product_id, i.current_stock]));

  const now = new Date();
  const today = now.toISOString().split('T')[0];
  const d3 = new Date(now);
  d3.setDate(d3.getDate() + 3);
  const threeDaysLater = d3.toISOString().split('T')[0];

  const lastReceivedMap: Record<number, string> = {};
  const nearestExpiryMap: Record<number, string> = {};
  for (const item of incoming) {
    const pid = item.product_id;
    if (!(pid in lastReceivedMap) && item.received_at) {
      lastReceivedMap[pid] = item.received_at.slice(0, 10);
    }
    if (item.expiry_date) {
      if (!(pid in nearestExpiryMap) || item.expiry_date < nearestExpiryMap[pid]) {
        nearestExpiryMap[pid] = item.expiry_date;
      }
    }
  }

  return (
    <div>
      <h1 className="text-xl font-bold text-slate-800 mb-4">{t('inventory.title', lang)}</h1>

      {products.length === 0 ? (
        <p className="text-slate-400 text-sm">{t('inventory.noProducts', lang)}</p>
      ) : (
        <div className="space-y-3">
          {products.map((p) => {
            const stock = stockMap[p.id] ?? 0;
            const lastReceived = lastReceivedMap[p.id];
            const nearestExpiry = nearestExpiryMap[p.id];
            const isExpiringSoon = nearestExpiry && nearestExpiry <= threeDaysLater;
            const isExpired = nearestExpiry && nearestExpiry < today;
            return (
              <div key={p.id} className="bg-white rounded-xl border border-slate-200 p-4">
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-slate-800">{p.name}</p>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-slate-700">{stock}</p>
                    <p className="text-xs text-slate-400">{t('inventory.units', lang)}</p>
                  </div>
                </div>
                {(lastReceived || nearestExpiry) && (
                  <div className="flex flex-wrap gap-4 mt-1.5 text-xs">
                    {lastReceived && (
                      <span className="text-slate-400">{t('inventory.lastReceived', lang)}: {lastReceived}</span>
                    )}
                    {nearestExpiry && (
                      <span className={isExpired ? 'text-red-600 font-medium' : isExpiringSoon ? 'text-orange-500 font-medium' : 'text-slate-400'}>
                        {p.expiry_type ?? t('inventory.expiryDate', lang)}: {nearestExpiry}
                        {isExpired ? ' ⚠' : isExpiringSoon ? ' !' : ''}
                      </span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
