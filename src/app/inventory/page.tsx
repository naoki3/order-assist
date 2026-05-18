import { createClient } from '@/lib/supabase';
import { getLang } from '@/lib/lang';
import { t } from '@/lib/i18n';
import type { Product, Inventory, Lot } from '@/lib/db';

export const dynamic = 'force-dynamic';

export default async function InventoryPage() {
  const [supabase, lang] = await Promise.all([createClient(), getLang()]);
  const [{ data: productsData }, { data: inventoriesData }, { data: lotsData }] = await Promise.all([
    supabase.from('products').select('*').order('id'),
    supabase.from('inventory').select('*'),
    supabase.from('lots').select('*').order('expiry_date', { ascending: true, nullsFirst: false }).order('received_at', { ascending: false }),
  ]);
  const products = (productsData ?? []) as Product[];
  const inventories = (inventoriesData ?? []) as Inventory[];
  const lots = (lotsData ?? []) as Lot[];

  const stockMap = Object.fromEntries(inventories.map((i) => [i.product_id, i.current_stock]));
  const lotsMap: Record<number, Lot[]> = {};
  for (const lot of lots) {
    if (!lotsMap[lot.product_id]) lotsMap[lot.product_id] = [];
    lotsMap[lot.product_id].push(lot);
  }

  const now = new Date();
  const today = now.toISOString().split('T')[0];
  const d3 = new Date(now);
  d3.setDate(d3.getDate() + 3);
  const threeDaysLater = d3.toISOString().split('T')[0];

  return (
    <div>
      <h1 className="text-xl font-bold text-slate-800 mb-4">{t('inventory.title', lang)}</h1>

      {products.length === 0 ? (
        <p className="text-slate-400 text-sm">{t('inventory.noProducts', lang)}</p>
      ) : (
        <div className="space-y-3">
          {products.map((p) => {
            const stock = stockMap[p.id] ?? 0;
            const productLots = lotsMap[p.id] ?? [];
            return (
              <div key={p.id} className="bg-white rounded-xl border border-slate-200 p-4">
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-slate-800">{p.name}</p>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-slate-700">{stock}</p>
                    <p className="text-xs text-slate-400">{t('inventory.units', lang)}</p>
                  </div>
                </div>

                {productLots.length === 0 ? (
                  <p className="mt-2 text-xs text-slate-400">{t('inventory.noLots', lang)}</p>
                ) : (
                  <div className="mt-2 space-y-1">
                    {productLots.map((lot) => {
                      const isExpired = lot.expiry_date && lot.expiry_date < today;
                      const isExpiringSoon = lot.expiry_date && !isExpired && lot.expiry_date <= threeDaysLater;
                      return (
                        <div key={lot.id} className="flex items-center justify-between text-xs bg-slate-50 rounded-lg px-3 py-1.5">
                          <div className="flex items-center gap-3">
                            <span className="text-[10px] font-bold text-slate-400 bg-slate-200 px-1 py-0.5 rounded tracking-wide">LOT</span>
                            <span className="font-mono text-slate-600">{lot.lot_number}</span>
                            {lot.expiry_date && (
                              <span className={
                                isExpired ? 'text-red-600 font-medium' :
                                isExpiringSoon ? 'text-orange-500 font-medium' :
                                'text-slate-400'
                              }>
                                {p.expiry_type ?? t('inventory.lotExpiry', lang)}: {lot.expiry_date}
                                {isExpired ? ' ⚠' : isExpiringSoon ? ' !' : ''}
                              </span>
                            )}
                          </div>
                          <span className="font-medium text-slate-700">{lot.quantity} {t('inventory.units', lang)}</span>
                        </div>
                      );
                    })}
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
