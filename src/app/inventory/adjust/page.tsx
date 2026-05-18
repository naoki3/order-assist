import { createClient } from '@/lib/supabase';
import { getLang } from '@/lib/lang';
import { t } from '@/lib/i18n';
import ProductCard from '@/components/ProductCard';
import AddProductForm from '@/components/AddProductForm';
import type { Product, Inventory } from '@/lib/db';

export const dynamic = 'force-dynamic';

export default async function InventoryAdjustPage() {
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
      <h1 className="text-xl font-bold text-slate-800 mb-4">{t('inventory.adjustTitle', lang)}</h1>

      <div className="space-y-3 mb-6">
        {products.length === 0 && (
          <p className="text-slate-400 text-sm">{t('inventory.noProducts', lang)}</p>
        )}
        {products.map((p) => (
          <ProductCard key={p.id} product={p} currentStock={stockMap[p.id] ?? 0} />
        ))}
      </div>

      <AddProductForm />
    </div>
  );
}
