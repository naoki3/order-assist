'use client';

import { useActionState, useEffect, useState } from 'react';
import { updateStock } from '@/lib/actions';
import { useT } from './LanguageProvider';
import { useActionFeedback } from '@/hooks/useActionFeedback';

interface Product {
  id: number;
  name: string;
  currentStock: number;
}

function StockAdjustRow({ product }: { product: Product }) {
  const { t } = useT();
  const [state, action] = useActionState(updateStock, null);
  const { successMsg, errorMsg } = useActionFeedback(state, t('common.updated'));
  const [formKey, setFormKey] = useState(0);

  useEffect(() => {
    if (state && 'success' in state) {
      const timer = setTimeout(() => setFormKey((k) => k + 1), 0);
      return () => clearTimeout(timer);
    }
  }, [state]);

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="font-semibold text-slate-800">{product.name}</p>
        <span className="text-sm text-slate-500">
          {t('inventory.currentStockLabel')}: <span className="font-medium text-slate-700">{product.currentStock}</span>
        </span>
      </div>
      <form key={formKey} action={action} className="flex items-center gap-2">
        <input type="hidden" name="product_id" value={product.id} />
        <input
          type="number"
          name="current_stock"
          min={0}
          required
          placeholder={t('inventory.newStockPlaceholder')}
          className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
        />
        <span className="text-sm text-slate-500 shrink-0">{t('inventory.units')}</span>
        <button
          type="submit"
          className="px-4 py-2 bg-green-700 text-white text-sm rounded-lg hover:bg-green-800 transition-colors font-medium shrink-0"
        >
          {t('inventory.adjustButton')}
        </button>
      </form>
      {errorMsg && (
        <p className="text-red-600 text-sm bg-red-50 rounded-lg px-3 py-2 mt-2">{errorMsg}</p>
      )}
      {successMsg && (
        <p className="text-green-600 text-sm bg-green-50 rounded-lg px-3 py-2 mt-2">{successMsg}</p>
      )}
    </div>
  );
}

interface Props {
  products: Product[];
}

export default function StockAdjustForm({ products }: Props) {
  return (
    <div className="space-y-3">
      {products.map((p) => (
        <StockAdjustRow key={p.id} product={p} />
      ))}
    </div>
  );
}
