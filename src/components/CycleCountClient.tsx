'use client';

import { useState, useTransition } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { useT } from './LanguageProvider';
import { formatDisplayDate } from '@/lib/tz';
import { formatQty } from '@/lib/units';
import type { UnitConfig } from '@/lib/units';
import { saveCycleCount } from '@/lib/actions';
import type { Lot } from '@/lib/db';

const COLOR_MAP: Record<string, string> = {
  slate:  'bg-slate-100 text-slate-700',
  red:    'bg-red-100 text-red-700',
  amber:  'bg-amber-100 text-amber-700',
  green:  'bg-green-100 text-green-700',
  blue:   'bg-blue-100 text-blue-700',
  purple: 'bg-purple-100 text-purple-700',
  orange: 'bg-orange-100 text-orange-700',
};

function StatusBadge({ name, color }: { name: string; color: string | null }) {
  const cls = COLOR_MAP[color ?? ''] ?? COLOR_MAP.slate;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${cls}`}>
      {name}
    </span>
  );
}

interface Props {
  lots: Lot[];
  unitMap: Record<number, UnitConfig>;
  warehouses: { id: number; name: string }[];
}

export default function CycleCountClient({ lots, unitMap, warehouses }: Props) {
  const { t, lang, localDate } = useT();
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>('');
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [rows, setRows] = useState<Record<number, string>>(() =>
    Object.fromEntries(lots.map((l) => [l.id, String(l.quantity)]))
  );
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  const filteredLots = selectedWarehouseId
    ? lots.filter((l) => String(l.warehouse_id ?? '') === selectedWarehouseId)
    : lots;

  const selectedWarehouse = warehouses.find((w) => String(w.id) === selectedWarehouseId);

  // Group by product
  const grouped = filteredLots.reduce<Record<string, Lot[]>>((acc, l) => {
    (acc[l.product_name] ??= []).push(l);
    return acc;
  }, {});

  function toggleCollapse(productName: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(productName)) next.delete(productName);
      else next.add(productName);
      return next;
    });
  }

  function handleChange(lotId: number, value: string) {
    setRows((prev) => ({ ...prev, [lotId]: value }));
    setMessage(null);
  }

  function handleSave() {
    const entries = lots.map((l) => ({
      lot_id: l.id,
      actual_qty: Number(rows[l.id] ?? l.quantity),
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
      }
    });
  }

  const totalChanges = filteredLots.filter((l) => {
    const actual = Number(rows[l.id] ?? l.quantity);
    return !isNaN(actual) && actual !== l.quantity;
  }).length;

  const uc = (l: Lot): UnitConfig => unitMap[l.product_id] ?? { pieces_per_ball: null, balls_per_case: null, cases_per_pallet: null };

  const formatPieces = (qty: number, lot: Lot): string => {
    const config = uc(lot);
    if (!config.pieces_per_ball) return `${qty}`;
    return formatQty(qty, config, lang);
  };

  if (lots.length === 0) {
    return <p className="text-slate-400 text-sm print:hidden">{t('cycleCount.noLots')}</p>;
  }

  // Build print rows (all lots in display order, with current values)
  const printRows = filteredLots.map((l) => ({
    lot: l,
    systemQty: l.quantity,
    actualQty: Number(rows[l.id] ?? l.quantity),
    diff: Number(rows[l.id] ?? l.quantity) - l.quantity,
  }));

  return (
    <>
      {/* ── Screen view ── */}
      <div className="print:hidden space-y-4">
        {/* Controls */}
        <div className="flex flex-wrap items-center gap-3">
          {warehouses.length > 0 && (
            <select
              value={selectedWarehouseId}
              onChange={(e) => setSelectedWarehouseId(e.target.value)}
              className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 bg-white"
            >
              <option value="">{t('cycleCount.allWarehouses')}</option>
              {warehouses.map((w) => (
                <option key={w.id} value={String(w.id)}>{w.name}</option>
              ))}
            </select>
          )}
          {filteredLots.length > 0 && (
            <button
              type="button"
              onClick={() => window.print()}
              className="px-3 py-2 text-sm border border-slate-300 rounded-lg text-slate-600 hover:bg-slate-50 transition-colors ml-auto"
            >
              {t('cycleCount.printConfirm')}
            </button>
          )}
        </div>

        {filteredLots.length === 0 ? (
          <p className="text-slate-400 text-sm">{t('cycleCount.noLots')}</p>
        ) : (
          <>
            {Object.entries(grouped).map(([productName, productLots]) => {
              const isOpen = !collapsed.has(productName);
              const systemTotal = productLots.reduce((s, l) => s + l.quantity, 0);
              const actualTotal = productLots.reduce((s, l) => s + (Number(rows[l.id] ?? l.quantity) || 0), 0);
              const hasChange = productLots.some((l) => Number(rows[l.id] ?? l.quantity) !== l.quantity);
              const sampleLot = productLots[0];

              return (
                <div key={productName} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                  <button
                    type="button"
                    onClick={() => toggleCollapse(productName)}
                    className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      {isOpen
                        ? <ChevronDown size={15} className="text-slate-400 shrink-0" />
                        : <ChevronRight size={15} className="text-slate-400 shrink-0" />}
                      <span className="text-sm font-semibold text-slate-800">{productName}</span>
                      {hasChange && (
                        <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full font-medium">差異あり</span>
                      )}
                    </div>
                    <div className="text-xs text-slate-400 flex items-center gap-2 shrink-0">
                      <span>システム: {formatPieces(systemTotal, sampleLot)}</span>
                      {actualTotal !== systemTotal && (
                        <span className={`font-semibold ${actualTotal < systemTotal ? 'text-red-500' : 'text-green-600'}`}>
                          → {formatPieces(actualTotal, sampleLot)}
                        </span>
                      )}
                    </div>
                  </button>

                  {isOpen && (
                    <table className="w-full text-sm border-t border-slate-100">
                      <thead>
                        <tr className="border-b border-slate-100 bg-slate-50">
                          <th className="px-4 py-2 text-left text-xs font-semibold text-slate-500">{t('inventory.lotNumber')}</th>
                          <th className="px-4 py-2 text-left text-xs font-semibold text-slate-500 hidden sm:table-cell">{t('inventory.lotExpiry')}</th>
                          <th className="px-4 py-2 text-left text-xs font-semibold text-slate-500 hidden md:table-cell">{t('inventory.location')}</th>
                          <th className="px-4 py-2 text-left text-xs font-semibold text-slate-500 hidden md:table-cell">{t('inventory.correctionStatus')}</th>
                          <th className="px-4 py-2 text-right text-xs font-semibold text-slate-500">{t('cycleCount.systemQty')}</th>
                          <th className="px-4 py-2 text-right text-xs font-semibold text-slate-500">{t('cycleCount.actualQty')}</th>
                          <th className="px-4 py-2 text-right text-xs font-semibold text-slate-500">{t('cycleCount.diff')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {productLots.map((lot) => {
                          const actual = Number(rows[lot.id] ?? lot.quantity);
                          const diff = isNaN(actual) ? null : actual - lot.quantity;
                          const config = uc(lot);
                          return (
                            <tr key={lot.id} className="border-b border-slate-100 last:border-0">
                              <td className="px-4 py-2 font-mono text-xs text-slate-700">{lot.lot_number}</td>
                              <td className="px-4 py-2 text-xs text-slate-500 hidden sm:table-cell">
                                {lot.expiry_date ? formatDisplayDate(lot.expiry_date) : '—'}
                              </td>
                              <td className="px-4 py-2 text-xs text-slate-500 hidden md:table-cell">
                                {lot.location_name ?? '—'}
                              </td>
                              <td className="px-4 py-2 hidden md:table-cell">
                                {lot.status_name
                                  ? <StatusBadge name={lot.status_name} color={lot.status_color ?? null} />
                                  : <span className="text-slate-300 text-xs">—</span>}
                              </td>
                              <td className="px-4 py-2 text-right tabular-nums text-slate-600 text-xs">
                                <div>{lot.quantity}</div>
                                {config.pieces_per_ball && (
                                  <div className="text-slate-400">{formatQty(lot.quantity, config, lang)}</div>
                                )}
                              </td>
                              <td className="px-4 py-2 text-right">
                                <input
                                  type="number"
                                  min="0"
                                  value={rows[lot.id] ?? lot.quantity}
                                  onChange={(e) => handleChange(lot.id, e.target.value)}
                                  className="w-20 text-right border border-slate-300 rounded-md px-2 py-1 text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-green-500"
                                />
                                {config.pieces_per_ball && !isNaN(actual) && (
                                  <div className="text-xs text-slate-400 mt-0.5 text-right">{formatQty(actual, config, lang)}</div>
                                )}
                              </td>
                              <td className={`px-4 py-2 text-right text-xs font-semibold tabular-nums ${diff == null ? '' : diff > 0 ? 'text-green-600' : diff < 0 ? 'text-red-600' : 'text-slate-300'}`}>
                                {diff == null ? '—' : diff === 0 ? '±0' : diff > 0 ? `+${diff}` : `${diff}`}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              );
            })}

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
          </>
        )}
      </div>

      {/* ── Print: Inventory Count Sheet ── */}
      {filteredLots.length > 0 && (
        <div className="hidden print:block text-sm">
          <h1 className="text-xl font-bold text-slate-800 mb-2">{t('cycleCount.confirmList')}</h1>
          <div className="border-b border-slate-300 pb-2 mb-4 text-xs text-slate-600 flex gap-6">
            <span>{t('cycleCount.countDate')}: {localDate()}</span>
            {selectedWarehouse && <span>{t('cycleCount.selectWarehouse')}: {selectedWarehouse.name}</span>}
          </div>
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100">
                <th className="border border-slate-300 px-2 py-1 text-left">{t('dailyReport.product')}</th>
                <th className="border border-slate-300 px-2 py-1 text-left">{t('inventory.lotNumber')}</th>
                <th className="border border-slate-300 px-2 py-1 text-left">{t('inventory.location')}</th>
                <th className="border border-slate-300 px-2 py-1 text-left hidden sm:table-cell">{t('inventory.lotExpiry')}</th>
                <th className="border border-slate-300 px-2 py-1 text-left">{t('inventory.correctionStatus')}</th>
                <th className="border border-slate-300 px-2 py-1 text-right">{t('cycleCount.systemQty')}</th>
                <th className="border border-slate-300 px-2 py-1 text-right">{t('cycleCount.actualQty')}</th>
                <th className="border border-slate-300 px-2 py-1 text-right">{t('cycleCount.diff')}</th>
              </tr>
            </thead>
            <tbody>
              {printRows.map(({ lot, systemQty, actualQty, diff }) => {
                const config = uc(lot);
                const sysStr = config.pieces_per_ball
                  ? `${systemQty} (${formatQty(systemQty, config, lang)})`
                  : String(systemQty);
                const actStr = config.pieces_per_ball
                  ? `${actualQty} (${formatQty(actualQty, config, lang)})`
                  : String(actualQty);
                return (
                  <tr key={lot.id} className="border-b border-slate-200">
                    <td className="border border-slate-300 px-2 py-1">{lot.product_name}</td>
                    <td className="border border-slate-300 px-2 py-1 font-mono">{lot.lot_number}</td>
                    <td className="border border-slate-300 px-2 py-1">{lot.location_name ?? '—'}</td>
                    <td className="border border-slate-300 px-2 py-1 hidden sm:table-cell">
                      {lot.expiry_date ? formatDisplayDate(lot.expiry_date) : '—'}
                    </td>
                    <td className="border border-slate-300 px-2 py-1">{lot.status_name ?? '—'}</td>
                    <td className="border border-slate-300 px-2 py-1 text-right tabular-nums">{sysStr}</td>
                    <td className="border border-slate-300 px-2 py-1 text-right tabular-nums">{actStr}</td>
                    <td className={`border border-slate-300 px-2 py-1 text-right font-semibold tabular-nums ${diff > 0 ? 'text-green-700' : diff < 0 ? 'text-red-700' : ''}`}>
                      {diff === 0 ? '±0' : diff > 0 ? `+${diff}` : `${diff}`}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
