'use client';

import { useState, useTransition } from 'react';
import { useT } from './LanguageProvider';
import { formatDisplayDate } from '@/lib/tz';
import { saveCycleCount } from '@/lib/actions';
import type { Lot } from '@/lib/db';

interface Props {
  lots: Lot[];
}

interface RowState {
  actual: string;
}

export default function CycleCountClient({ lots }: Props) {
  const { t } = useT();
  const [rows, setRows] = useState<Record<number, RowState>>(() =>
    Object.fromEntries(lots.map((l) => [l.id, { actual: String(l.quantity) }]))
  );
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  if (lots.length === 0) {
    return <p className="text-slate-400 text-sm">{t('cycleCount.noLots')}</p>;
  }

  // Group by product
  const grouped = lots.reduce<Record<string, Lot[]>>((acc, l) => {
    const key = l.product_name;
    (acc[key] ??= []).push(l);
    return acc;
  }, {});

  function handleChange(lotId: number, value: string) {
    setRows((prev) => ({ ...prev, [lotId]: { actual: value } }));
    setMessage(null);
  }

  function handleSave() {
    const entries = lots.map((l) => ({
      lot_id: l.id,
      actual_qty: Number(rows[l.id]?.actual ?? l.quantity),
    })).filter((e) => !isNaN(e.actual_qty));

    const changed = entries.filter((e) => {
      const lot = lots.find((l) => l.id === e.lot_id);
      return lot && e.actual_qty !== lot.quantity;
    });

    if (changed.length === 0) {
      setMessage({ type: 'success', text: t('cycleCount.noChanges') });
      return;
    }

    startTransition(async () => {
      const result = await saveCycleCount(entries);
      if (result && 'error' in result) {
        setMessage({ type: 'error', text: result.error });
      } else {
        setMessage({ type: 'success', text: t('cycleCount.saved') });
        // Reset baseline to new values
        setRows(Object.fromEntries(lots.map((l) => {
          const entry = entries.find((e) => e.lot_id === l.id);
          return [l.id, { actual: String(entry?.actual_qty ?? l.quantity) }];
        })));
      }
    });
  }

  const totalChanges = lots.filter((l) => {
    const actual = Number(rows[l.id]?.actual ?? l.quantity);
    return !isNaN(actual) && actual !== l.quantity;
  }).length;

  return (
    <div className="space-y-6">
      {Object.entries(grouped).map(([productName, productLots]) => (
        <div key={productName} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200">
            <p className="text-sm font-semibold text-slate-800">{productName}</p>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="px-4 py-2 text-left text-xs font-semibold text-slate-500">{t('inventory.lotNumber')}</th>
                <th className="px-4 py-2 text-left text-xs font-semibold text-slate-500 hidden sm:table-cell">{t('inventory.lotExpiry')}</th>
                <th className="px-4 py-2 text-left text-xs font-semibold text-slate-500 hidden md:table-cell">{t('inventory.location')}</th>
                <th className="px-4 py-2 text-right text-xs font-semibold text-slate-500">{t('cycleCount.systemQty')}</th>
                <th className="px-4 py-2 text-right text-xs font-semibold text-slate-500">{t('cycleCount.actualQty')}</th>
                <th className="px-4 py-2 text-right text-xs font-semibold text-slate-500">{t('cycleCount.diff')}</th>
              </tr>
            </thead>
            <tbody>
              {productLots.map((lot) => {
                const actual = Number(rows[lot.id]?.actual ?? lot.quantity);
                const diff = isNaN(actual) ? null : actual - lot.quantity;
                return (
                  <tr key={lot.id} className="border-b border-slate-100 last:border-0">
                    <td className="px-4 py-2 font-mono text-xs text-slate-700">{lot.lot_number}</td>
                    <td className="px-4 py-2 text-xs text-slate-500 hidden sm:table-cell">
                      {lot.expiry_date ? formatDisplayDate(lot.expiry_date) : '—'}
                    </td>
                    <td className="px-4 py-2 text-xs text-slate-500 hidden md:table-cell">
                      {lot.location_name ?? '—'}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums text-slate-600">{lot.quantity}</td>
                    <td className="px-4 py-2 text-right">
                      <input
                        type="number"
                        min="0"
                        value={rows[lot.id]?.actual ?? lot.quantity}
                        onChange={(e) => handleChange(lot.id, e.target.value)}
                        className="w-20 text-right border border-slate-300 rounded-md px-2 py-1 text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-green-500"
                      />
                    </td>
                    <td className={`px-4 py-2 text-right text-xs font-semibold tabular-nums ${diff == null ? '' : diff > 0 ? 'text-green-600' : diff < 0 ? 'text-red-600' : 'text-slate-300'}`}>
                      {diff == null ? '—' : diff === 0 ? '±0' : diff > 0 ? `+${diff}` : `${diff}`}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ))}

      {message && (
        <p className={`text-sm ${message.type === 'error' ? 'text-red-600' : 'text-green-700'}`}>{message.text}</p>
      )}

      <div className="flex items-center justify-between">
        {totalChanges > 0 && (
          <p className="text-xs text-slate-500">{totalChanges}件の差異があります</p>
        )}
        <button
          type="button"
          onClick={handleSave}
          disabled={isPending}
          className="ml-auto px-4 py-2 bg-green-700 text-white text-sm rounded-lg hover:bg-green-800 disabled:opacity-50 transition-colors font-medium"
        >
          {isPending ? t('cycleCount.saving') : t('cycleCount.save')}
        </button>
      </div>
    </div>
  );
}
