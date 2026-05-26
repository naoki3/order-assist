import { createClient } from '@/lib/supabase';
import { getLang } from '@/lib/lang';
import { t } from '@/lib/i18n';
import type { Product, Inventory } from '@/lib/db';
import ProductListClient from '@/components/ProductListClient';

export const dynamic = 'force-dynamic';

export default async function ProductsPage() {
  const [supabase, lang] = await Promise.all([createClient(), getLang()]);
  const [{ data: productsData }, { data: inventoriesData }, { data: warehousesData }] = await Promise.all([
    supabase.from('products').select('*').order('id'),
    supabase.from('inventory').select('*'),
    supabase.from('warehouses').select('id, name').order('name'),
  ]);
  const products = (productsData ?? []) as Product[];
  const inventories = (inventoriesData ?? []) as Inventory[];
  const warehouses = (warehousesData ?? []) as { id: number; name: string }[];
  const stockMap = Object.fromEntries(inventories.map((i) => [i.product_id, i.current_stock]));

  return (
    <div>
      <h1 className="text-xl font-bold text-slate-800 mb-4">{t('products.title', lang)}</h1>
      <ProductListClient products={products} stockMap={stockMap} warehouses={warehouses} />
    </div>
  );
}
