'use client';

import { useActionState, useState } from 'react';
import { upsertProductSales } from '@/lib/actions';

interface Props {
  productId: number;
  price: number | null;
  entries: { date: string; label: string; defaultQuantity: number }[];
}

export default function SaleForm({ productId, price, entries }: Props) {
  const [state, action, pending] = useActionState(upsertProductSales, null);
  const [quantities, setQuantities] = useState<Record<string, number>>(
    Object.fromEntries(entries.map((e) => [e.date, e.defaultQuantity]))
  );

  const totalUnits = Object.values(quantities).reduce((s, q) => s + q, 0);
  const totalRevenue = price != null ? totalUnits * price : null;

  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="product_id" value={productId} />
      {entries.map(({ date, label }) => (
        <div key={date} className="flex items-center gap-3">
          <input type="hidden" name="date" value={date} />
          <span className="text-sm text-slate-500 w-10 shrink-0">{label}</span>
          <input
            type="number"
            name="quantity"
            value={quantities[date] ?? 0}
            onChange={(e) => setQuantities((prev) => ({ ...prev, [date]: Math.max(0, Number(e.target.value)) }))}
            min={0}
            required
            className="w-20 border border-slate-300 rounded-lg px-3 py-1.5 text-sm text-center focus:outline-none focus:ring-2 focus:ring-green-500"
          />
          <span className="text-sm text-slate-400">units</span>
          {price != null && (
            <span className="text-xs text-slate-400 ml-auto">
              {((quantities[date] ?? 0) * price).toLocaleString()}
            </span>
          )}
        </div>
      ))}
      <div className="flex items-center justify-between pt-1">
        <div className="text-xs text-slate-400">
          Total: <span className="font-medium text-slate-600">{totalUnits} units</span>
          {totalRevenue != null && (
            <span className="ml-2 font-medium text-green-700">{totalRevenue.toLocaleString()}</span>
          )}
        </div>
        <button
          type="submit"
          disabled={pending}
          className="px-4 py-1.5 bg-slate-100 text-slate-600 text-sm rounded-lg hover:bg-slate-200 transition-colors disabled:opacity-50"
        >
          {pending ? 'Saving...' : 'Save'}
        </button>
      </div>
      {state?.error && (
        <p className="text-red-600 text-sm bg-red-50 rounded-lg px-3 py-2">{state.error}</p>
      )}
    </form>
  );
}
