'use client';

import { useActionState } from 'react';
import { upsertSale } from '@/lib/actions';

interface Props {
  productId: number;
  date: string;
  defaultQuantity: number;
  label: string;
}

export default function SaleForm({ productId, date, defaultQuantity, label }: Props) {
  const [state, action] = useActionState(upsertSale, null);

  return (
    <div>
      <form action={action} className="flex items-center gap-3">
        <input type="hidden" name="product_id" value={productId} />
        <input type="hidden" name="date" value={date} />
        <span className="text-sm text-slate-500 w-10 shrink-0">{label}</span>
        <input
          type="number"
          name="quantity"
          defaultValue={defaultQuantity}
          min={0}
          required
          className="w-20 border border-slate-300 rounded-lg px-3 py-1.5 text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <span className="text-sm text-slate-400">units</span>
        <button
          type="submit"
          className="px-3 py-1.5 bg-slate-100 text-slate-600 text-sm rounded-lg hover:bg-slate-200 transition-colors"
        >
          Save
        </button>
        {state?.error && (
          <span className="text-red-600 text-xs">{state.error}</span>
        )}
      </form>
    </div>
  );
}
