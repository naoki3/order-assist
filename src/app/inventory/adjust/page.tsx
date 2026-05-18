import { createClient } from '@/lib/supabase';
import { getLang } from '@/lib/lang';
import { t } from '@/lib/i18n';
import LotAdjustForm from '@/components/LotAdjustForm';
import StockAdjustForm from '@/components/StockAdjustForm';
import type { Product, Inventory, Lot } from '@/lib/db';

export const dynamic = 'force-dynamic';

export default async function InventoryAdjustPage() {
  const [supabase, lang] = await Promise.all([createClient(), getLang()]);
  const [{ data: productsData }, { data: inventoriesData }, { data: lotsData }] = await Promise.all([
    supabase.from('products').select('*').order('id'),
    supabase.from('inventory').select('*'),
    supabase.from('lots').select('*').order('expiry_date', { ascending: true, nullsFirst: false }),
  ]);
  const products = (productsData ?? []) as Product[];
  const inventories = (inventoriesData ?? []) as Inventory[];
  const lots = (lotsData ?? []) as Lot[];

  const stockMap = Object.fromEntries(inventories.map((i) => [i.product_id, i.current_stock]));
  const productsWithStock = products.map((p) => ({ id: p.id, name: p.name, currentStock: stockMap[p.id] ?? 0 }));

  const noLotProducts = productsWithStock.filter(p => !lots.some(l => l.product_id === p.id));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-800 mb-1">{t('inventory.adjustTitle', lang)}</h1>
        <p className="text-sm text-slate-500">{t('inventory.adjustSubtitle', lang)}</p>
      </div>

      {products.length === 0 ? (
        <p className="text-slate-400 text-sm">{t('inventory.noProducts', lang)}</p>
      ) : (
        <div className="space-y-3">
          <LotAdjustForm lots={lots} />
          <StockAdjustForm products={noLotProducts} />
        </div>
      )}
    </div>
  );
}
