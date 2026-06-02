'use client';

import { useState, useActionState } from 'react';
import { transferStock } from '@/lib/actions';
import { useT } from './LanguageProvider';
import { useActionFeedback } from '@/hooks/useActionFeedback';
import type { Lot } from '@/lib/db';
import { formatQty } from '@/lib/units';
import { formatDisplayDate } from '@/lib/tz';

interface LocationOption {
  id: number;
  name: string;
  warehouse_id: number | null;
}

interface ProductOption {
  id: number;
  name: string;
  pieces_per_ball: number | null;
  balls_per_case: number | null;
  cases_per_pallet: number | null;
}

export default function StockTransferForm({
  lots,
  locations,
  products,
}: {
  lots: Lot[];
  locations: LocationOption[];
  products: ProductOption[];
}) {
  const { t, lang } = useT();
  const [state, action] = useActionState(transferStock, null);
  const { successMsg, errorMsg } = useActionFeedback(state, t('transfer.success'));

  const [selectedProductId, setSelectedProductId] = useState('');
  const [selectedLotId, setSelectedLotId] = useState('');

  const selectedProduct = products.find((p) => p.id === Number(selectedProductId)) ?? null;
  const productLots = lots.filter(
    (l) => l.product_id === Number(selectedProductId) && l.quantity > 0
  ).sort((a, b) => {
    if (!a.expiry_date && !b.expiry_date) return 0;
    if (!a.expiry_date) return 1;
    if (!b.expiry_date) return -1;
    return a.expiry_date.localeCompare(b.expiry_date);
  });

  const selectedLot = lots.find((l) => l.id === Number(selectedLotId)) ?? null;

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-4">
      <form action={action} className="space-y-3">
        <div>
          <select
            name="product_id_ui"
            value={selectedProductId}
            onChange={(e) => { setSelectedProductId(e.target.value); setSelectedLotId(''); }}
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          >
            <option value="">{t('transfer.selectProduct')}</option>
            {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>

        {selectedProductId && (
          <div>
            <select
              name="lot_id"
              required
              value={selectedLotId}
              onChange={(e) => setSelectedLotId(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              <option value="">{t('transfer.selectLot')}</option>
              {productLots.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.lot_number}
                  {l.expiry_date ? ` · ${t('inventory.lotExpiry')} ${formatDisplayDate(l.expiry_date)}` : ''}
                  {l.location_name ? ` · ${l.location_name}` : ''}
                  {` · `}
                  {selectedProduct?.pieces_per_ball
                    ? formatQty(l.quantity, selectedProduct, lang)
                    : `${l.quantity}${t('inventory.units')}`}
                </option>
              ))}
            </select>
            {productLots.length === 0 && (
              <p className="text-slate-400 text-xs mt-1">{t('transfer.noLots')}</p>
            )}
          </div>
        )}

        {selectedLotId && selectedLot && (
          <>
            <div className="bg-slate-50 rounded-lg px-3 py-2 text-xs text-slate-600 space-y-0.5">
              <p>{t('inventory.lotNumber')}: <span className="font-medium">{selectedLot.lot_number}</span></p>
              {selectedLot.location_name && (
                <p>{t('inventory.location')}: <span className="font-medium">{selectedLot.location_name}</span></p>
              )}
              <p>
                {t('inventory.lotQty')}:{' '}
                <span className="font-medium">
                  {selectedProduct?.pieces_per_ball
                    ? formatQty(selectedLot.quantity, selectedProduct, lang)
                    : `${selectedLot.quantity} ${t('inventory.units')}`}
                </span>
              </p>
            </div>

            <div>
              <input
                type="number"
                name="quantity"
                required
                min={1}
                max={selectedLot.quantity}
                placeholder={t('transfer.quantity')}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>

            <div>
              <select
                name="to_location_id"
                required
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              >
                <option value="">{t('transfer.toLocation')}</option>
                {locations.map((l) => (
                  <option key={l.id} value={l.id}>{l.name}</option>
                ))}
              </select>
            </div>

            <div>
              <input
                type="text"
                name="note"
                placeholder={t('transfer.note')}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>

            <button
              type="submit"
              className="w-full py-2 bg-green-700 text-white text-sm rounded-lg hover:bg-green-800 transition-colors font-medium"
            >
              {t('transfer.submit')}
            </button>
          </>
        )}
      </form>

      {errorMsg && <p className="text-red-600 text-xs">{errorMsg}</p>}
      {successMsg && <p className="text-green-600 text-xs">{successMsg}</p>}
    </div>
  );
}
