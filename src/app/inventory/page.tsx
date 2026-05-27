import { createClient } from '@/lib/supabase';
import { getLang } from '@/lib/lang';
import { t } from '@/lib/i18n';
import type { Product, Inventory } from '@/lib/db';
import InventoryListClient from '@/components/InventoryListClient';

export const dynamic = 'force-dynamic';

export default async function InventoryPage() {
  const [supabase, lang] = await Promise.all([createClient(), getLang()]);
  const [{ data: productsData }, { data: inventoriesData }] = await Promise.all([
    supabase.from('products').select('*').order('name'),
    supabase.from('inventory').select('*'),
  ]);
  const products = (productsData ?? []) as Product[];
  const inventories = (inventoriesData ?? []) as Inventory[];
  const stockMap = Object.fromEntries(inventories.map((i) => [i.product_id, i.current_stock]));

  return (
    <div>
      <h1 className="text-xl font-bold text-slate-800 mb-4">{t('inventory.title', lang)}</h1>
      <InventoryListClient products={products} stockMap={stockMap} />
    </div>
  );
}
