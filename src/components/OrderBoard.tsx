'use client';

import { useState, useTransition } from 'react';
import { placeOrder } from '@/lib/actions';
import type { Recommendation } from '@/lib/calculator';

interface Props {
  recommendations: Recommendation[];
}

function alertLevel(r: Recommendation): 'stockout' | 'overstock' | null {
  if (r.avgDemand7d <= 0) return null;
  const daysRemaining = r.currentStock / r.avgDemand7d;
  if (daysRemaining < r.product.lead_time_days) return 'stockout';
  if (r.orderQty === 0 && r.currentStock > r.requiredStock * 3) return 'overstock';
  return null;
}

export default function OrderBoard({ recommendations }: Props) {
  const [quantities, setQuantities] = useState<Record<number, number>>(
    Object.fromEntries(recommendations.map((r) => [r.product.id, r.orderQty]))
  );
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function adjust(id: number, delta: number) {
    setQuantities((prev) => ({
      ...prev,
      [id]: Math.max(0, (prev[id] ?? 0) + delta),
    }));
  }

  function handleOrder() {
    setError(null);
    startTransition(async () => {
      const items = recommendations.map((r) => ({
        productId: r.product.id,
        productName: r.product.name,
        quantity: quantities[r.product.id] ?? 0,
      }));
      const result = await placeOrder(items);
      if (result === null) {
        setDone(true);
      } else {
        setError(result.error);
      }
    });
  }

  if (done) {
    return (
      <div className="text-center py-16">
        <div className="text-5xl mb-4">✅</div>
        <p className="text-xl font-bold text-slate-800">Order placed!</p>
        <p className="text-slate-500 mt-2 mb-6">You can review the details in Order History</p>
        <button
          onClick={() => setDone(false)}
          className="px-4 py-2 bg-slate-100 rounded-lg text-slate-700 hover:bg-slate-200 transition-colors"
        >
          Back
        </button>
      </div>
    );
  }

  const orderCount = Object.values(quantities).filter((q) => q > 0).length;
  const hasAnyPrice = recommendations.some((r) => r.product.price != null);
  const totalOrderValue = hasAnyPrice
    ? recommendations.reduce((sum, r) => {
        const qty = quantities[r.product.id] ?? 0;
        return sum + (r.product.price != null ? qty * r.product.price : 0);
      }, 0)
    : null;

  return (
    <div className="space-y-3">
      {recommendations.map((r) => {
        const qty = quantities[r.product.id] ?? 0;
        const isZero = qty === 0;
        const alert = alertLevel(r);
        const cardClass =
          alert === 'stockout'
            ? 'border-red-300 bg-red-50'
            : alert === 'overstock'
            ? 'border-amber-300 bg-amber-50'
            : isZero
            ? 'border-slate-200 opacity-70'
            : 'border-blue-200 shadow-sm';

        return (
          <div key={r.product.id} className={`bg-white rounded-xl border p-4 ${cardClass}`}>
            <div className="flex items-center justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-semibold text-slate-800 truncate">{r.product.name}</p>
                  {alert === 'stockout' && (
                    <span className="text-xs text-red-600 font-medium bg-red-100 px-1.5 py-0.5 rounded">
                      Stockout risk
                    </span>
                  )}
                  {alert === 'overstock' && (
                    <span className="text-xs text-amber-600 font-medium bg-amber-100 px-1.5 py-0.5 rounded">
                      Overstock
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 mt-0.5">{r.reason}</p>
                <p className="text-xs text-slate-400 mt-0.5">
                  Stock {r.currentStock} / Required {r.requiredStock}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => adjust(r.product.id, -1)}
                  className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-lg flex items-center justify-center transition-colors"
                >
                  −
                </button>
                <span
                  className={`w-12 text-center font-bold text-xl ${
                    isZero ? 'text-slate-300' : 'text-blue-600'
                  }`}
                >
                  {qty}
                </span>
                <button
                  onClick={() => adjust(r.product.id, 1)}
                  className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-lg flex items-center justify-center transition-colors"
                >
                  ＋
                </button>
              </div>
            </div>
          </div>
        );
      })}

      {error && (
        <p className="text-red-600 text-sm bg-red-50 rounded-xl px-4 py-3">{error}</p>
      )}

      {totalOrderValue !== null && orderCount > 0 && (
        <p className="text-right text-sm text-slate-500">
          Estimated order value:{' '}
          <span className="font-semibold text-slate-700">
            {totalOrderValue.toLocaleString(undefined, { minimumFractionDigits: 0 })}
          </span>
        </p>
      )}

      <div className="pt-2">
        <button
          onClick={handleOrder}
          disabled={isPending || orderCount === 0}
          className={`w-full py-4 rounded-xl font-bold text-lg transition-colors ${
            orderCount === 0
              ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
              : 'bg-blue-600 hover:bg-blue-700 text-white shadow-sm'
          }`}
        >
          {isPending
            ? 'Processing...'
            : orderCount === 0
            ? 'No products to order'
            : `Place order (${orderCount} item${orderCount === 1 ? '' : 's'})`}
        </button>
      </div>
    </div>
  );
}
