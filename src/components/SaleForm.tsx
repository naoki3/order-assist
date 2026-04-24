'use client';

import { useActionState } from 'react';
import { upsertProductSales } from '@/lib/actions';

interface Props {
  productId: number;
  entries: { date: string; label: string; defaultQuantity: number }[];
}

export default function SaleForm({ productId, entries }: Props) {
  const [state, action, pending] = useActionState(upsertProductSales, null);

  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="product_id" value={productId} />
      {entries.map(({ date, label, defaultQuantity }) => (
        <div key={date} className="flex items-center gap-3">
          <input type="hidden" name="date" value={date} />
          <span className="text-sm text-slate-500 w-10 shrink-0">{label}</span>
          <input
            type="number"
            name="quantity"
            defaultValue={defaultQuantity}
            min={0}
            required
            className="w-20 border border-slate-300 rounded-lg px-3 py-1.5 text-sm text-center focus:outline-none focus:ring-2 focus:ring-green-500"
          />
          <span className="text-sm text-slate-400">units</span>
        </div>
      ))}
      {state?.error && (
        <p className="text-red-600 text-sm bg-red-50 rounded-lg px-3 py-2">{state.error}</p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="mt-1 px-4 py-1.5 bg-slate-100 text-slate-600 text-sm rounded-lg hover:bg-slate-200 transition-colors disabled:opacity-50"
      >
        {pending ? 'Saving...' : 'Save'}
      </button>
    </form>
  );
}
