'use client';

import { useActionState, useEffect, useState } from 'react';
import { updateLotProperties } from '@/lib/actions';
import { useT } from './LanguageProvider';
import { useActionFeedback } from '@/hooks/useActionFeedback';
import type { Lot, Product } from '@/lib/db';
import LotTag from './LotTag';
import { formatQty } from '@/lib/units';
import type { UnitConfig } from '@/lib/units';
import DateInput from './DateInput';

function LotCorrectionRow({ lot, today, unitConfig }: { lot: Lot; today: string; unitConfig: UnitConfig }) {
  const { t } = useT();
  const [state, action] = useActionState(updateLotProperties, null);
  const { successMsg, errorMsg } = useActionFeedback(state, t('common.saved'));
  const [formKey, setFormKey] = useState(0);

  useEffect(() => {
    if (state && 'success' in state) {
      const timer = setTimeout(() => setFormKey((k) => k + 1), 0);
      return () => clearTimeout(timer);
    }
  }, [state]);

  const qtyStr = unitConfig.pieces_per_ball
    ? `${formatQty(lot.quantity, unitConfig)} (${lot.quantity}ピース)`
    : `${lot.quantity} ${t('inventory.units')}`;

  return (
    <div className="py-3 border-t border-slate-100">
      <div className="flex items-start justify-between mb-2">
        <LotTag lotNumber={lot.lot_number} expiryDate={lot.expiry_date} today={today} expiryLabel={t('inventory.lotExpiry')} />
        <span className="text-sm text-slate-500 shrink-0 ml-3">
          {t('inventory.currentStockLabel')}: {qtyStr}
        </span>
      </div>
      <form key={formKey} action={action} className="space-y-2">
        <input type="hidden" name="lot_id" value={lot.id} />
        <div>
          <label className="text-xs font-medium text-slate-500 mb-1 block">{t('inventory.correctionLotNumber')}</label>
          <input
            type="text"
            name="lot_number"
            required
            defaultValue={lot.lot_number}
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-green-500"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-slate-500 mb-1 block">{t('inventory.correctionExpiry')}</label>
          <DateInput name="expiry_date" defaultValue={lot.expiry_date ?? ''} className="w-full text-sm" />
        </div>
        <div className="flex justify-end">
          <button
            type="submit"
            className="px-4 py-2 bg-green-700 text-white text-sm rounded-lg hover:bg-green-800 transition-colors font-medium"
          >
            {t('inventory.correctionSave')}
          </button>
        </div>
      </form>
      {errorMsg && <p className="text-red-600 text-sm bg-red-50 rounded-lg px-3 py-2 mt-2">{errorMsg}</p>}
      {successMsg && <p className="text-green-600 text-sm bg-green-50 rounded-lg px-3 py-2 mt-2">{successMsg}</p>}
    </div>
  );
}

export default function LotCorrectionForm({ lots, products }: { lots: Lot[]; products: Product[] }) {
  const { t, localDate } = useT();
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
          ? `${formatQty(total, uc)} (${total}ピース)`
          : `${total} ${t('inventory.units')}`;
        return (
          <div key={product.id} className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="flex items-center justify-between mb-1">
              <p className="font-semibold text-slate-800">{product.name}</p>
              <span className="text-sm text-slate-500">{totalStr}</span>
            </div>
            {productLots.map((lot) => (
              <LotCorrectionRow key={lot.id} lot={lot} today={today} unitConfig={uc} />
            ))}
          </div>
        );
      })}
    </div>
  );
}
