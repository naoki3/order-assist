import { createClient } from '@/lib/supabase';
import { getLang, getTz } from '@/lib/lang';
import { toLocalDateStr } from '@/lib/tz';
import { t } from '@/lib/i18n';
import type { Product, Inventory, Lot } from '@/lib/db';
import LotTag from '@/components/LotTag';

export const dynamic = 'force-dynamic';

export default async function InventoryPage() {
  const [supabase, lang, tz] = await Promise.all([createClient(), getLang(), getTz()]);
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

  const today = toLocalDateStr(tz);

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
                      return (
                        <div key={lot.id} className="flex items-center justify-between bg-slate-50 rounded-lg px-3 py-2">
                          <LotTag
                            lotNumber={lot.lot_number}
                            expiryDate={lot.expiry_date}
                            today={today}
                            expiryLabel={p.expiry_type ?? t('inventory.lotExpiry', lang)}
                          />
                          <span className="text-sm font-medium text-slate-700 shrink-0 ml-3">{lot.quantity} {t('inventory.units', lang)}</span>
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
