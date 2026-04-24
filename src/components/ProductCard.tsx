'use client';

import { useActionState } from 'react';
import { updateProduct, deleteProduct, updateStock } from '@/lib/actions';
import type { Product } from '@/lib/db';

interface Props {
  product: Product;
  currentStock: number;
}

export default function ProductCard({ product, currentStock }: Props) {
  const [updateState, updateAction] = useActionState(updateProduct, null);
  const [stockState, stockAction] = useActionState(updateStock, null);
  const [deleteState, deleteAction] = useActionState(deleteProduct, null);

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4">
      {/* Edit product */}
      <form action={updateAction} className="space-y-3">
        <input type="hidden" name="id" value={product.id} />
        <div className="flex gap-2">
          <input
            type="text"
            name="name"
            defaultValue={product.name}
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
        <div className="flex flex-wrap gap-3 text-sm">
          <label className="flex items-center gap-1 text-slate-600">
            Lead time
            <input
              type="number"
              name="lead_time_days"
              defaultValue={product.lead_time_days}
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
              defaultValue={product.safety_stock_days}
              min={1}
              max={14}
              required
              className="w-14 border border-slate-300 rounded px-2 py-1 text-center"
            />
            days
          </label>
        </div>
        {updateState?.error && (
          <p className="text-red-600 text-sm bg-red-50 rounded-lg px-3 py-2">{updateState.error}</p>
        )}
      </form>

      {/* Stock update + Delete */}
      <div className="flex items-center gap-2 mt-3 pt-3 border-t border-slate-100">
        <form action={stockAction} className="flex items-center gap-2 flex-1">
          <input type="hidden" name="product_id" value={product.id} />
          <span className="text-sm text-slate-500">Current stock:</span>
          <input
            type="number"
            name="current_stock"
            defaultValue={currentStock}
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
        </form>

        <form action={deleteAction}>
          <input type="hidden" name="id" value={product.id} />
          <button
            type="submit"
            className="px-3 py-1 text-red-500 text-sm rounded-lg hover:bg-red-50 transition-colors"
          >
            Delete
          </button>
        </form>
      </div>

      {stockState?.error && (
        <p className="text-red-600 text-sm bg-red-50 rounded-lg px-3 py-2 mt-2">
          {stockState.error}
        </p>
      )}
      {deleteState?.error && (
        <p className="text-red-600 text-sm bg-red-50 rounded-lg px-3 py-2 mt-2">
          {deleteState.error}
        </p>
      )}
    </div>
  );
}
