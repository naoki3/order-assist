import { createClient } from '@/lib/supabase';
import { getLang } from '@/lib/lang';
import { t } from '@/lib/i18n';
import type { Product, Inventory } from '@/lib/db';
import InventoryListClient from '@/components/InventoryListClient';

export const dynamic = 'force-dynamic';

export default async function InventoryPage() {
  const [supabase, lang] = await Promise.all([createClient(), getLang()]);
  const [{ data: productsData }, { data: inventoriesData }] = await Promise.all([
    supabase.from('products').select('*').order('name').limit(1000),
    supabase.from('inventory').select('*').limit(1000),
  ]);
  const allProducts = (productsData ?? []) as Product[];
  const inventories = (inventoriesData ?? []) as Inventory[];
  const stockMap = Object.fromEntries(inventories.map((i) => [i.product_id, i.current_stock]));
  const products = allProducts.filter((p) => (stockMap[p.id] ?? 0) > 0);

  return (
    <div>
      <h1 className="text-xl font-bold text-slate-800 mb-4">{t('inventory.title', lang)}</h1>
      <InventoryListClient products={products} stockMap={stockMap} />
    </div>
  );
}
