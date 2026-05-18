import { createClient } from '@/lib/supabase';
import { getLang } from '@/lib/lang';
import { t } from '@/lib/i18n';
import type { Product, Inventory } from '@/lib/db';

export const dynamic = 'force-dynamic';

export default async function InventoryPage() {
  const [supabase, lang] = await Promise.all([createClient(), getLang()]);
  const [{ data: productsData }, { data: inventoriesData }] = await Promise.all([
    supabase.from('products').select('*').order('id'),
    supabase.from('inventory').select('*'),
  ]);
  const products = (productsData ?? []) as Product[];
  const inventories = (inventoriesData ?? []) as Inventory[];
  const stockMap = Object.fromEntries(inventories.map((i) => [i.product_id, i.current_stock]));

  return (
    <div>
      <h1 className="text-xl font-bold text-slate-800 mb-4">{t('inventory.title', lang)}</h1>

      {products.length === 0 ? (
        <p className="text-slate-400 text-sm">{t('inventory.noProducts', lang)}</p>
      ) : (
        <div className="space-y-3">
          {products.map((p) => {
            const stock = stockMap[p.id] ?? 0;
            return (
              <div key={p.id} className="bg-white rounded-xl border border-slate-200 p-4">
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-slate-800">{p.name}</p>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-slate-700">{stock}</p>
                    <p className="text-xs text-slate-400">{t('inventory.units', lang)}</p>
                  </div>
                </div>
                <div className="flex gap-4 mt-2 text-xs text-slate-500">
                  <span>{t('products.leadTime', lang)} {p.lead_time_days}{t('products.days', lang)}</span>
                  <span>{t('products.safetyStock', lang)} {p.safety_stock_days}{t('products.days', lang)}</span>
                  {p.price != null && <span>{t('products.unitPrice', lang)} {p.price}</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
