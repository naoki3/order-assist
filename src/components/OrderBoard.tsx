'use client';

import { useState, useTransition } from 'react';
import { placeOrder } from '@/lib/actions';
import type { Recommendation } from '@/lib/calculator';
import { useT } from './LanguageProvider';

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

function sortPriority(r: Recommendation): number {
  const alert = alertLevel(r);
  if (alert === 'stockout') return 0;
  if (r.orderQty > 0) return 1;
  if (alert === 'overstock') return 3;
  return 2;
}

export default function OrderBoard({ recommendations }: Props) {
  const { t, tf } = useT();
  const [quantities, setQuantities] = useState<Record<number, number>>(
    Object.fromEntries(recommendations.map((r) => [r.product.id, r.orderQty]))
  );
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const sorted = [...recommendations].sort((a, b) => sortPriority(a) - sortPriority(b));

  function adjust(id: number, delta: number) {
    setQuantities((prev) => ({ ...prev, [id]: Math.max(0, (prev[id] ?? 0) + delta) }));
  }

  function handleQtyInput(id: number, val: string) {
    const n = parseInt(val, 10);
    if (!isNaN(n) && n >= 0) setQuantities((prev) => ({ ...prev, [id]: n }));
    else if (val === '') setQuantities((prev) => ({ ...prev, [id]: 0 }));
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
      if (result && 'error' in result) setError(result.error);
      else setDone(true);
    });
  }

  if (done) {
    return (
      <div className="text-center py-16">
        <div className="text-5xl mb-4">✅</div>
        <p className="text-xl font-bold text-slate-800">{t('order.placed')}</p>
        <p className="text-slate-500 mt-2 mb-6">{t('order.reviewInHistory')}</p>
        <button
          onClick={() => setDone(false)}
          className="px-4 py-2 bg-slate-100 rounded-lg text-slate-700 hover:bg-slate-200 transition-colors"
        >
          {t('order.back')}
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
      {sorted.map((r) => {
        const qty = quantities[r.product.id] ?? 0;
        const isZero = qty === 0;
        const alert = alertLevel(r);
        const daysLeft = r.avgDemand7d > 0 ? r.currentStock / r.avgDemand7d : null;

        const cardClass =
          alert === 'stockout'
            ? 'border-red-300 bg-red-50'
            : alert === 'overstock'
            ? 'border-amber-300 bg-amber-50'
            : isZero
            ? 'border-slate-100 bg-slate-50 opacity-60'
            : 'border-green-200 bg-white';

        return (
          <div key={r.product.id} className={`rounded-xl border p-4 ${cardClass}`}>
            <div className="flex items-center justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-semibold text-slate-800 truncate">{r.product.name}</p>
                  {alert === 'stockout' && (
                    <span className="text-xs text-red-600 font-medium bg-red-100 px-1.5 py-0.5 rounded shrink-0">
                      {t('order.stockoutRisk')}
                    </span>
                  )}
                  {alert === 'overstock' && (
                    <span className="text-xs text-amber-600 font-medium bg-amber-100 px-1.5 py-0.5 rounded shrink-0">
                      {t('order.overstock')}
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 mt-0.5">{r.reason}</p>
                <p className="text-xs text-slate-400 mt-0.5">
                  {t('order.stockLabel')} {r.currentStock} · {t('order.requiredLabel')} {r.requiredStock}
                  {daysLeft !== null && ` · 残${daysLeft.toFixed(1)}日`}
                </p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  onClick={() => adjust(r.product.id, -1)}
                  className="w-9 h-9 rounded-full bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-base flex items-center justify-center transition-colors select-none"
                >
                  −
                </button>
                <input
                  type="number"
                  min={0}
                  value={qty}
                  onChange={(e) => handleQtyInput(r.product.id, e.target.value)}
                  className={`w-12 text-center font-bold text-lg bg-transparent border-0 outline-none p-0 ${
                    isZero ? 'text-slate-300' : 'text-green-700'
                  }`}
                />
                <button
                  onClick={() => adjust(r.product.id, 1)}
                  className="w-9 h-9 rounded-full bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-base flex items-center justify-center transition-colors select-none"
                >
                  +
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
          {t('order.estimatedValue')}
          <span className="font-semibold text-slate-700">
            ¥{totalOrderValue.toLocaleString(undefined, { minimumFractionDigits: 0 })}
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
              : 'bg-green-700 hover:bg-green-800 text-white shadow-sm'
          }`}
        >
          {isPending
            ? t('order.processing')
            : orderCount === 0
            ? t('order.noProducts')
            : tf<string>('order.placeOrder', orderCount)}
        </button>
      </div>
    </div>
  );
}
