'use client';

import { useActionState, useEffect, useState } from 'react';
import { updateLotQuantity } from '@/lib/actions';
import { useT } from './LanguageProvider';
import { useActionFeedback } from '@/hooks/useActionFeedback';
import type { Lot, Product } from '@/lib/db';
import LotTag from './LotTag';
import { formatQty } from '@/lib/units';
import type { UnitConfig } from '@/lib/units';

function LotRow({ lot, today, unitConfig }: { lot: Lot; today: string; unitConfig: UnitConfig }) {
  const { t, lang } = useT();
  const [state, action] = useActionState(updateLotQuantity, null);
  const { successMsg, errorMsg } = useActionFeedback(state, t('common.updated'));
  const [formKey, setFormKey] = useState(0);

  useEffect(() => {
    if (state && 'success' in state) {
      const timer = setTimeout(() => setFormKey((k) => k + 1), 0);
      return () => clearTimeout(timer);
    }
  }, [state]);

  const qtyStr = unitConfig.pieces_per_ball
    ? `${formatQty(lot.quantity, unitConfig, lang)} (${lot.quantity}${t('units.pieceSuffix')})`
    : `${lot.quantity}`;

  return (
    <div className="py-3 border-t border-slate-100">
      <div className="flex items-start justify-between mb-2">
        <LotTag lotNumber={lot.lot_number} expiryDate={lot.expiry_date} today={today} expiryLabel={t('inventory.lotExpiry')} />
        <span className="text-sm font-medium text-slate-600 shrink-0 ml-3">
          {t('inventory.currentStockLabel')}: {qtyStr}
        </span>
      </div>
      <form key={formKey} action={action} className="flex items-center gap-2">
        <input type="hidden" name="lot_id" value={lot.id} />
        <input
          type="number"
          name="quantity"
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
      {errorMsg && <p className="text-red-600 text-sm bg-red-50 rounded-lg px-3 py-2 mt-1">{errorMsg}</p>}
      {successMsg && <p className="text-green-600 text-sm bg-green-50 rounded-lg px-3 py-2 mt-1">{successMsg}</p>}
    </div>
  );
}

export default function LotAdjustForm({ lots, products }: { lots: Lot[]; products: Product[] }) {
  const { t, localDate, lang } = useT();
  const [today] = useState(() => localDate());

  const productMap = Object.fromEntries(products.map((p) => [p.id, p]));
  const grouped: Map<number, { product: Product; lots: Lot[] }> = new Map();
  for (const lot of lots) {
    const p = productMap[lot.product_id];
    if (!p) continue;
    if (!grouped.has(lot.product_id)) grouped.set(lot.product_id, { product: p, lots: [] });
    grouped.get(lot.product_id)!.lots.push(lot);
  }

  return (
    <div className="space-y-3">
      {Array.from(grouped.values()).map(({ product, lots: productLots }) => {
        const total = productLots.reduce((s, l) => s + l.quantity, 0);
        const uc: UnitConfig = product;
        const totalStr = uc.pieces_per_ball
          ? `${formatQty(total, uc, lang)} (${total}${t('units.pieceSuffix')})`
          : `${total}`;
        return (
          <div key={product.id} className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="flex items-center justify-between mb-1">
              <p className="font-semibold text-slate-800">{product.name}</p>
              <span className="text-sm text-slate-500">{totalStr}</span>
            </div>
            {productLots.map((lot) => (
              <LotRow key={lot.id} lot={lot} today={today} unitConfig={uc} />
            ))}
          </div>
        );
      })}
    </div>
  );
}
