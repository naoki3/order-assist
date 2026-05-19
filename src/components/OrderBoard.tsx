'use client';

import { useState, useTransition } from 'react';
import { Plus, X } from 'lucide-react';
import { placeOrder } from '@/lib/actions';
import type { OrderItem } from '@/lib/actions';
import type { Recommendation } from '@/lib/calculator';
import { useT } from './LanguageProvider';
import DateInput from './DateInput';
import { getAvailableUnits, unitToPieces, formatQty, getUnitLabels } from '@/lib/units';
import type { UnitType, UnitConfig } from '@/lib/units';

interface Props {
  recommendations: Recommendation[];
}

interface OrderLine {
  productId: number;
  productName: string;
  qty: number;
}

export default function OrderBoard({ recommendations }: Props) {
  const { t, tf, localDate, lang } = useT();
  const unitLabels = getUnitLabels(lang);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [expectedDate, setExpectedDate] = useState(() => localDate());
  const [lines, setLines] = useState<OrderLine[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [inputQty, setInputQty] = useState('');
  const [inputUnit, setInputUnit] = useState<UnitType>('piece');

  const selectedRec = recommendations.find((r) => r.product.id === Number(selectedId));
  const unitConfig: UnitConfig = selectedRec?.product ?? { pieces_per_ball: null, balls_per_case: null, cases_per_pallet: null };
  const units = getAvailableUnits(unitConfig);
  const inputPieces = unitToPieces(Number(inputQty) || 0, inputUnit, unitConfig);
  const showBreakdown = inputPieces > 0 && inputUnit !== 'piece' && unitConfig.pieces_per_ball != null;

  function handleProductChange(id: string) {
    setSelectedId(id);
    if (id) {
      const rec = recommendations.find((r) => r.product.id === Number(id));
      const recUnitConfig: UnitConfig = rec?.product ?? { pieces_per_ball: null, balls_per_case: null, cases_per_pallet: null };
      const recUnits = getAvailableUnits(recUnitConfig);
      setInputUnit(recUnits[recUnits.length - 1]); // default to smallest unit (piece)
      if (rec && rec.orderQty > 0) setInputQty(String(rec.orderQty));
      else setInputQty('');
    } else {
      setInputQty('');
      setInputUnit('piece');
    }
  }

  function addLine() {
    const qty = Number(inputQty);
    if (!selectedId || isNaN(qty) || qty < 1) return;
    const rec = recommendations.find((r) => r.product.id === Number(selectedId));
    if (!rec) return;
    const pieces = inputPieces > 0 ? inputPieces : qty;
    setLines((prev) => {
      const idx = prev.findIndex((l) => l.productId === Number(selectedId));
      const line: OrderLine = { productId: rec.product.id, productName: rec.product.name, qty: pieces };
      if (idx >= 0) { const next = [...prev]; next[idx] = line; return next; }
      return [...prev, line];
    });
    setSelectedId('');
    setInputQty('');
    setInputUnit('piece');
  }

  function handleOrder() {
    if (!expectedDate || lines.length === 0) return;
    setError(null);
    startTransition(async () => {
      const items: OrderItem[] = lines.map((l) => ({
        productId: l.productId,
        productName: l.productName,
        quantity: l.qty,
        expectedDate,
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
          onClick={() => { setDone(false); setLines([]); }}
          className="px-4 py-2 bg-slate-100 rounded-lg text-slate-700 hover:bg-slate-200 transition-colors"
        >
          {t('order.back')}
        </button>
      </div>
    );
  }

  const hasPrice = lines.some((l) => {
    const rec = recommendations.find((r) => r.product.id === l.productId);
    return rec?.product.price != null;
  });
  const totalOrderValue = hasPrice
    ? lines.reduce((sum, l) => {
        const rec = recommendations.find((r) => r.product.id === l.productId);
        return sum + (rec?.product.price != null ? l.qty * rec.product.price : 0);
      }, 0)
    : null;

  return (
    <div className="space-y-3">
      {/* Date picker */}
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-wide">
          {t('order.expectedDate')}
        </label>
        <DateInput
          value={expectedDate}
          onChange={setExpectedDate}
          className="w-full text-sm"
        />
      </div>

      {/* Product selector */}
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <p className="text-xs font-semibold text-slate-500 mb-2 uppercase tracking-wide">{t('order.addProduct')}</p>
        <div className="flex gap-2">
          <select
            value={selectedId}
            onChange={(e) => handleProductChange(e.target.value)}
            className="flex-1 min-w-0 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 bg-white"
          >
            <option value="">{t('order.selectProduct')}</option>
            {recommendations.map((r) => (
              <option key={r.product.id} value={r.product.id}>
                {r.product.name}
                {r.orderQty > 0 ? `  (${tf<string>('order.suggestedQty', r.orderQty)})` : ''}
              </option>
            ))}
          </select>
          <div className="flex flex-col gap-0.5">
            <div className="flex gap-1">
              <input
                type="number"
                min={1}
                value={inputQty}
                onChange={(e) => setInputQty(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addLine()}
                placeholder={t('order.qtyPlaceholder')}
                className="w-20 border border-slate-300 rounded-lg px-3 py-2 text-sm text-center focus:outline-none focus:ring-2 focus:ring-green-500"
              />
              {units.length > 1 ? (
                <select
                  value={inputUnit}
                  onChange={(e) => { setInputUnit(e.target.value as UnitType); setInputQty(''); }}
                  className="border border-slate-300 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 bg-white shrink-0"
                >
                  {units.map((u) => <option key={u} value={u}>{unitLabels[u]}</option>)}
                </select>
              ) : (
                <span className="text-sm text-slate-500 self-center px-1 shrink-0">{unitLabels[units[0]]}</span>
              )}
            </div>
            {showBreakdown && (
              <p className="text-xs text-slate-400">= {formatQty(inputPieces, unitConfig)}</p>
            )}
          </div>
          <button
            type="button"
            onClick={addLine}
            disabled={!selectedId || !inputQty}
            className="px-3 py-2 bg-green-700 text-white rounded-lg hover:bg-green-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors self-start"
          >
            <Plus size={16} />
          </button>
        </div>
      </div>

      {/* Order lines */}
      {lines.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-4 py-2.5 border-b border-slate-100">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
              {tf<string>('order.orderLines', lines.length)}
            </p>
          </div>
          <div className="divide-y divide-slate-100">
            {lines.map((line) => {
              const lineRec = recommendations.find((r) => r.product.id === line.productId);
              const lineUnitConfig: UnitConfig = lineRec?.product ?? { pieces_per_ball: null, balls_per_case: null, cases_per_pallet: null };
              return (
              <div key={line.productId} className="flex items-center justify-between px-4 py-3">
                <div>
                  <span className="text-sm font-medium text-slate-800">{line.productName}</span>
                  {lineUnitConfig.pieces_per_ball ? (
                    <span className="text-xs text-slate-500 ml-2">{formatQty(line.qty, lineUnitConfig)}</span>
                  ) : (
                    <span className="text-xs text-slate-500 ml-2">{line.qty} {t('incoming.units')}</span>
                  )}
                </div>
                <button type="button" onClick={() => setLines((p) => p.filter((l) => l.productId !== line.productId))}
                  className="text-slate-300 hover:text-red-500 transition-colors ml-3">
                  <X size={16} />
                </button>
              </div>
              );
            })}
          </div>
          {totalOrderValue !== null && (
            <div className="px-4 py-2.5 border-t border-slate-100 text-right">
              <span className="text-xs text-slate-500">{t('order.estimatedValue')}</span>
              <span className="text-sm font-semibold text-slate-700 ml-1">
                {totalOrderValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </span>
            </div>
          )}
        </div>
      )}

      {error && <p className="text-red-600 text-sm bg-red-50 rounded-xl px-4 py-3">{error}</p>}

      <button
        onClick={handleOrder}
        disabled={isPending || lines.length === 0 || !expectedDate}
        className={`w-full py-4 rounded-xl font-bold text-lg transition-colors ${
          lines.length === 0
            ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
            : 'bg-green-700 hover:bg-green-800 text-white shadow-sm'
        }`}
      >
        {isPending ? t('order.processing') : lines.length === 0
          ? t('order.noProducts')
          : tf<string>('order.placeOrder', lines.length)}
      </button>
    </div>
  );
}
