import { createClient } from '@/lib/supabase';
import ProductCard from '@/components/ProductCard';
import AddProductForm from '@/components/AddProductForm';
import type { Product, Inventory } from '@/lib/db';

export const dynamic = 'force-dynamic';

export default async function ProductsPage() {
  const supabase = await createClient();
  const { data: productsData } = await supabase.from('products').select('*').order('id');
  const products = (productsData ?? []) as Product[];

  const { data: inventoriesData } = await supabase.from('inventory').select('*');
  const inventories = (inventoriesData ?? []) as Inventory[];
  const stockMap = Object.fromEntries(inventories.map((i) => [i.product_id, i.current_stock]));

  return (
    <div>
      <h1 className="text-xl font-bold text-slate-800 mb-4">Products</h1>

      <div className="space-y-3 mb-6">
        {products.length === 0 && (
          <p className="text-slate-400 text-sm">No products yet. Add one below.</p>
        )}
        {products.map((p) => (
          <ProductCard key={p.id} product={p} currentStock={stockMap[p.id] ?? 0} />
        ))}
      </div>

      <AddProductForm />
    </div>
  );
}
