'use client';

import { useState, useTransition } from 'react';
import { placeOrder } from '@/lib/actions';
import type { Recommendation } from '@/lib/calculator';

interface Props {
  recommendations: Recommendation[];
}

export default function OrderBoard({ recommendations }: Props) {
  const [quantities, setQuantities] = useState<Record<number, number>>(
    Object.fromEntries(recommendations.map((r) => [r.product.id, r.orderQty]))
  );
  const [done, setDone] = useState(false);
  const [isPending, startTransition] = useTransition();

  function adjust(id: number, delta: number) {
    setQuantities((prev) => ({
      ...prev,
      [id]: Math.max(0, (prev[id] ?? 0) + delta),
    }));
  }

  function handleOrder() {
    startTransition(async () => {
      const items = recommendations.map((r) => ({
        productId: r.product.id,
        productName: r.product.name,
        quantity: quantities[r.product.id] ?? 0,
      }));
      const result = await placeOrder(items);
      if (result.success) setDone(true);
    });
  }

  if (done) {
    return (
      <div className="text-center py-16">
        <div className="text-5xl mb-4">✅</div>
        <p className="text-xl font-bold text-slate-800">発注しました！</p>
        <p className="text-slate-500 mt-2 mb-6">内容は発注履歴から確認できます</p>
        <button
          onClick={() => setDone(false)}
          className="px-4 py-2 bg-slate-100 rounded-lg text-slate-700 hover:bg-slate-200 transition-colors"
        >
          戻る
        </button>
      </div>
    );
  }

  const orderCount = Object.values(quantities).filter((q) => q > 0).length;

  return (
    <div className="space-y-3">
      {recommendations.map((r) => {
        const qty = quantities[r.product.id] ?? 0;
        const isZero = qty === 0;
        return (
          <div
            key={r.product.id}
            className={`bg-white rounded-xl border p-4 ${
              isZero ? 'border-slate-200 opacity-70' : 'border-blue-200 shadow-sm'
            }`}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-slate-800 truncate">{r.product.name}</p>
                <p className="text-xs text-slate-500 mt-0.5">{r.reason}</p>
                <p className="text-xs text-slate-400 mt-0.5">
                  在庫 {r.currentStock}個 / 必要 {r.requiredStock}個
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
            ? '処理中...'
            : orderCount === 0
            ? '発注する商品がありません'
            : `この内容で発注（${orderCount}商品）`}
        </button>
      </div>
    </div>
  );
}
