'use client';

import { useActionState } from 'react';
import { addProduct } from '@/lib/actions';

export default function AddProductForm() {
  const [state, action] = useActionState(addProduct, null);

  return (
    <div className="bg-white rounded-xl border border-dashed border-slate-300 p-4">
      <h2 className="text-sm font-semibold text-slate-600 mb-3">Add New Product</h2>
      <form action={action} className="space-y-3">
        <input
          type="text"
          name="name"
          required
          placeholder="Product name"
          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <div className="flex flex-wrap gap-3 text-sm">
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
        {state?.error && (
          <p className="text-red-600 text-sm bg-red-50 rounded-lg px-3 py-2">{state.error}</p>
        )}
        <button
          type="submit"
          className="w-full py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors font-medium"
        >
          Add Product
        </button>
      </form>
    </div>
  );
}
