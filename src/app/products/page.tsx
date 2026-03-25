import { supabase } from '@/lib/supabase';
import { addProduct, updateProduct, deleteProduct, updateStock } from '@/lib/actions';
import type { Product, Inventory } from '@/lib/db';

export const dynamic = 'force-dynamic';

export default async function ProductsPage() {
  const { data: productsData } = await supabase.from('products').select('*').order('id');
  const products = (productsData ?? []) as Product[];

  const { data: inventoriesData } = await supabase.from('inventory').select('*');
  const inventories = (inventoriesData ?? []) as Inventory[];
  const stockMap = Object.fromEntries(inventories.map((i) => [i.product_id, i.current_stock]));

  return (
    <div>
      <h1 className="text-xl font-bold text-slate-800 mb-4">Products</h1>

      {/* Product list */}
      <div className="space-y-3 mb-6">
        {products.length === 0 && (
          <p className="text-slate-400 text-sm">No products yet. Add one below.</p>
        )}
        {products.map((p) => (
          <div key={p.id} className="bg-white rounded-xl border border-slate-200 p-4">
            <form action={updateProduct} className="space-y-3">
              <input type="hidden" name="id" value={p.id} />
              <div className="flex gap-2">
                <input
                  type="text"
                  name="name"
                  defaultValue={p.name}
                  required
                  className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Product name"
                />
                <button
                  type="submit"
                  className="px-3 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Save
                </button>
              </div>
              <div className="flex gap-3 text-sm">
                <label className="flex items-center gap-1 text-slate-600">
                  Lead time
                  <input
                    type="number"
                    name="lead_time_days"
                    defaultValue={p.lead_time_days}
                    min={1}
                    max={30}
                    required
                    className="w-14 border border-slate-300 rounded px-2 py-1 text-center"
                  />
                  days
                </label>
                <label className="flex items-center gap-1 text-slate-600">
                  Safety stock
                  <input
                    type="number"
                    name="safety_stock_days"
                    defaultValue={p.safety_stock_days}
                    min={1}
                    max={14}
                    required
                    className="w-14 border border-slate-300 rounded px-2 py-1 text-center"
                  />
                  days
                </label>
              </div>
            </form>

            {/* Stock update */}
            <form action={updateStock} className="flex items-center gap-2 mt-3 pt-3 border-t border-slate-100">
              <input type="hidden" name="product_id" value={p.id} />
              <span className="text-sm text-slate-500">Current stock:</span>
              <input
                type="number"
                name="current_stock"
                defaultValue={stockMap[p.id] ?? 0}
                min={0}
                className="w-20 border border-slate-300 rounded px-2 py-1 text-sm text-center"
              />
              <span className="text-sm text-slate-500">units</span>
              <button
                type="submit"
                className="px-3 py-1 bg-slate-100 text-slate-700 text-sm rounded-lg hover:bg-slate-200 transition-colors"
              >
                Update
              </button>

              {/* Delete */}
              <form action={deleteProduct} className="ml-auto">
                <input type="hidden" name="id" value={p.id} />
                <button
                  type="submit"
                  className="px-3 py-1 text-red-500 text-sm rounded-lg hover:bg-red-50 transition-colors"
                >
                  Delete
                </button>
              </form>
            </form>
          </div>
        ))}
      </div>

      {/* Add new product */}
      <div className="bg-white rounded-xl border border-dashed border-slate-300 p-4">
        <h2 className="text-sm font-semibold text-slate-600 mb-3">Add New Product</h2>
        <form action={addProduct} className="space-y-3">
          <input
            type="text"
            name="name"
            required
            placeholder="Product name"
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <div className="flex gap-3 text-sm">
            <label className="flex items-center gap-1 text-slate-600">
              Lead time
              <input
                type="number"
                name="lead_time_days"
                defaultValue={2}
                min={1}
                max={30}
                required
                className="w-14 border border-slate-300 rounded px-2 py-1 text-center"
              />
              days
            </label>
            <label className="flex items-center gap-1 text-slate-600">
              Safety stock
              <input
                type="number"
                name="safety_stock_days"
                defaultValue={1}
                min={1}
                max={14}
                required
                className="w-14 border border-slate-300 rounded px-2 py-1 text-center"
              />
              days
            </label>
          </div>
          <button
            type="submit"
            className="w-full py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            Add Product
          </button>
        </form>
      </div>
    </div>
  );
}
