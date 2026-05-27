'use client';

import { useState, useActionState, useEffect } from 'react';
import { useT } from './LanguageProvider';
import { useActionFeedback } from '@/hooks/useActionFeedback';
import { updateLotProperties, transferStock, updateStock } from '@/lib/actions';
import type { Lot, Product } from '@/lib/db';
import { formatQty } from '@/lib/units';
import LotTag from './LotTag';
import DateInput from './DateInput';
import { formatDisplayDate } from '@/lib/tz';

interface LocationOption {
  id: number;
  name: string;
  warehouse_id: number | null;
  warehouse_name: string | null;
}

interface Props {
  product: Product;
  lots: Lot[];
  currentStock: number;
  locations: LocationOption[];
  today: string;
}

function LotCard({ lot, product, locations, today }: {
  lot: Lot;
  product: Product;
  locations: LocationOption[];
  today: string;
}) {
  const { t, lang } = useT();
  const [mode, setMode] = useState<'none' | 'correction' | 'transfer'>('none');

  const [corrState, corrAction] = useActionState(updateLotProperties, null);
  const { successMsg: corrSuccess, errorMsg: corrError } = useActionFeedback(corrState, t('common.saved'));
  const [corrKey, setCorrKey] = useState(0);
  useEffect(() => {
    if (corrState && 'success' in corrState) {
      setTimeout(() => { setCorrKey((k) => k + 1); setMode('none'); }, 500);
    }
  }, [corrState]);

  const [transState, transAction] = useActionState(transferStock, null);
  const { successMsg: transSuccess, errorMsg: transError } = useActionFeedback(transState, t('transfer.success'));
  const [transKey, setTransKey] = useState(0);
  useEffect(() => {
    if (transState && 'success' in transState) {
      setTimeout(() => { setTransKey((k) => k + 1); setMode('none'); }, 500);
    }
  }, [transState]);

  // Filter locations: if lot has a warehouse, only show locations in that warehouse
  const filteredLocations = lot.warehouse_id
    ? locations.filter((l) => l.warehouse_id === lot.warehouse_id)
    : locations;

  const qtyStr = product.pieces_per_ball
    ? `${formatQty(lot.quantity, product, lang)} (${lot.quantity}${t('units.pieceSuffix')})`
    : `${lot.quantity} ${t('inventory.units')}`;

  return (
    <div className="bg-slate-50 rounded-lg px-3 py-3 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0 space-y-0.5">
          <LotTag lotNumber={lot.lot_number} expiryDate={lot.expiry_date} today={today} expiryLabel={t('inventory.lotExpiry')} />
          <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-slate-400">
            {lot.warehouse_name && <span>{t('incoming.warehouseScheduled')}: {lot.warehouse_name}</span>}
            {lot.location_name && <span>{t('inventory.location')}: {lot.location_name}</span>}
            {lot.received_at && <span>{t('inventory.lastReceived')}: {formatDisplayDate(lot.received_at)}</span>}
          </div>
        </div>
        <span className="text-sm font-semibold text-slate-700 shrink-0">{qtyStr}</span>
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setMode(mode === 'correction' ? 'none' : 'correction')}
          className={`text-xs px-2 py-1 rounded-lg border transition-colors ${mode === 'correction' ? 'bg-slate-200 border-slate-300' : 'border-slate-200 hover:bg-slate-100'}`}
        >
          {t('inventory.correctionTitle')}
        </button>
        {filteredLocations.length > 0 && (
          <button
            type="button"
            onClick={() => setMode(mode === 'transfer' ? 'none' : 'transfer')}
            className={`text-xs px-2 py-1 rounded-lg border transition-colors ${mode === 'transfer' ? 'bg-slate-200 border-slate-300' : 'border-slate-200 hover:bg-slate-100'}`}
          >
            {t('transfer.title')}
          </button>
        )}
      </div>

      {mode === 'correction' && (
        <form key={corrKey} action={corrAction} className="space-y-2 pt-1">
          <input type="hidden" name="lot_id" value={lot.id} />
          <div>
            <label className="text-xs text-slate-500 mb-0.5 block">{t('inventory.correctionLotNumber')}</label>
            <input type="text" name="lot_number" required defaultValue={lot.lot_number}
              className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-green-500" />
          </div>
          <div>
            <label className="text-xs text-slate-500 mb-0.5 block">{t('inventory.correctionExpiry')}</label>
            <DateInput name="expiry_date" defaultValue={lot.expiry_date ?? ''} className="w-full text-sm" />
          </div>
          {corrError && <p className="text-red-600 text-xs">{corrError}</p>}
          {corrSuccess && <p className="text-green-600 text-xs">{corrSuccess}</p>}
          <button type="submit" className="w-full py-1.5 bg-green-700 text-white text-xs rounded-lg hover:bg-green-800 transition-colors font-medium">
            {t('inventory.correctionSave')}
          </button>
        </form>
      )}

      {mode === 'transfer' && (
        <form key={transKey} action={transAction} className="space-y-2 pt-1">
          <input type="hidden" name="lot_id" value={lot.id} />
          <div>
            <label className="text-xs text-slate-500 mb-0.5 block">{t('transfer.quantity')}</label>
            <input type="number" name="quantity" required min={1} max={lot.quantity} defaultValue={lot.quantity}
              className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
          </div>
          <div>
            <label className="text-xs text-slate-500 mb-0.5 block">{t('transfer.toLocation')}</label>
            <select name="to_location_id" required
              className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500">
              <option value="">—</option>
              {filteredLocations.map((l) => (
                <option key={l.id} value={l.id}>{l.name}{l.warehouse_name ? ` (${l.warehouse_name})` : ''}</option>
              ))}
            </select>
          </div>
          <div>
            <input type="text" name="note" placeholder={t('transfer.note')}
              className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
          </div>
          {transError && <p className="text-red-600 text-xs">{transError}</p>}
          {transSuccess && <p className="text-green-600 text-xs">{transSuccess}</p>}
          <button type="submit" className="w-full py-1.5 bg-green-700 text-white text-xs rounded-lg hover:bg-green-800 transition-colors font-medium">
            {t('transfer.submit')}
          </button>
        </form>
      )}
    </div>
  );
}

function StockAdjustSection({ product, currentStock }: { product: Product; currentStock: number }) {
  const { t } = useT();
  const [state, action] = useActionState(updateStock, null);
  const { successMsg, errorMsg } = useActionFeedback(state, t('common.saved'));
  const [open, setOpen] = useState(false);

  return (
    <div className="border-t border-slate-100 pt-3 mt-3">
      <button type="button" onClick={() => setOpen((v) => !v)}
        className="text-xs text-slate-500 hover:text-slate-700 underline">
        {t('inventory.adjustTitle')}
      </button>
      {open && (
        <form action={action} className="flex gap-2 mt-2">
          <input type="hidden" name="product_id" value={product.id} />
          <input type="number" name="current_stock" required min={0} defaultValue={currentStock}
            className="flex-1 border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
          <button type="submit" className="px-3 py-1.5 bg-slate-700 text-white text-xs rounded-lg hover:bg-slate-800 transition-colors font-medium">
            {t('inventory.adjustButton')}
          </button>
        </form>
      )}
      {errorMsg && <p className="text-red-600 text-xs mt-1">{errorMsg}</p>}
      {successMsg && <p className="text-green-600 text-xs mt-1">{successMsg}</p>}
    </div>
  );
}

export default function InventoryDetailClient({ product, lots, currentStock, locations, today }: Props) {
  const { t, lang } = useT();

  const totalStr = product.pieces_per_ball
    ? `${formatQty(currentStock, product, lang)} (${currentStock}${t('units.pieceSuffix')})`
    : `${currentStock.toLocaleString()} ${t('inventory.units')}`;

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-slate-600">{t('inventory.title')}</h2>
        <span className="text-2xl font-bold text-slate-700">{totalStr}</span>
      </div>

      {lots.length === 0 ? (
        <p className="text-sm text-slate-400">{t('inventory.noLots')}</p>
      ) : (
        <div className="space-y-2">
          {lots.map((lot) => (
            <LotCard key={lot.id} lot={lot} product={product} locations={locations} today={today} />
          ))}
        </div>
      )}

      <StockAdjustSection product={product} currentStock={currentStock} />
    </div>
  );
}
