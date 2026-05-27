'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import type { OutgoingStock } from '@/lib/db';
import { useT } from './LanguageProvider';
import { formatQty } from '@/lib/units';
import type { UnitConfig } from '@/lib/units';
import { formatDisplayDate } from '@/lib/tz';

type SortMode = 'location' | 'expiry' | 'lot';

function groupByDate(items: OutgoingStock[]) {
  const map = new Map<string, OutgoingStock[]>();
  for (const item of items) {
    const arr = map.get(item.scheduled_date) ?? [];
    arr.push(item);
    map.set(item.scheduled_date, arr);
  }
  return Array.from(map.entries())
    .map(([date, its]) => ({ date, items: its }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

function sortItems(items: OutgoingStock[], mode: SortMode): OutgoingStock[] {
  return [...items].sort((a, b) => {
    if (mode === 'location') {
      const wa = a.warehouse_name ?? '', wb = b.warehouse_name ?? '';
      if (wa !== wb) return wa.localeCompare(wb);
      const la = a.location_name ?? '', lb = b.location_name ?? '';
      if (la !== lb) return la.localeCompare(lb);
    } else if (mode === 'expiry') {
      const ea = a.expiry_date ?? '9999-99-99', eb = b.expiry_date ?? '9999-99-99';
      if (ea !== eb) return ea.localeCompare(eb);
    } else {
      const la = a.lot_number ?? '', lb = b.lot_number ?? '';
      if (la !== lb) return la.localeCompare(lb);
    }
    return a.product_name.localeCompare(b.product_name);
  });
}

function AllocationItem({ item, unitMap }: { item: OutgoingStock; unitMap: Record<number, UnitConfig> }) {
  const { t, lang } = useT();
  const unitConfig = unitMap[item.product_id] ?? { pieces_per_ball: null, balls_per_case: null, cases_per_pallet: null };
  return (
    <div className="py-2.5">
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-1.5 flex-wrap">
            <span className="text-sm font-medium text-slate-800">{item.product_name}</span>
            {unitConfig.pieces_per_ball ? (
              <span className="text-xs text-slate-500">{formatQty(item.quantity, unitConfig, lang)} ({item.quantity}{t('units.pieceSuffix')})</span>
            ) : (
              <span className="text-xs text-slate-500">{item.quantity} {t('shipping.units')}</span>
            )}
          </div>
          <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
            {item.lot_number && (
              <span className="text-xs font-mono text-slate-600">{t('shipping.pickingLot')}: {item.lot_number}</span>
            )}
            {item.expiry_date && (
              <span className="text-xs text-slate-500">{t('inventory.lotExpiry')}: {formatDisplayDate(item.expiry_date)}</span>
            )}
            {item.location_name && (
              <span className="text-xs text-slate-500">{t('inventory.location')}: {item.location_name}</span>
            )}
            {item.warehouse_name && (
              <span className="text-xs text-slate-500">{t('incoming.warehouseScheduled')}: {item.warehouse_name}</span>
            )}
            {item.destination_name && (
              <span className="text-xs text-slate-400">{t('shipping.destination')}: {item.destination_name}</span>
            )}
            {item.carrier_name && (
              <span className="text-xs text-slate-400">{t('shipping.carrier')}: {item.carrier_name}</span>
            )}
          </div>
          {item.note && <p className="text-xs text-slate-400 mt-0.5">· {item.note}</p>}
        </div>
      </div>
    </div>
  );
}

function DateGroup({ date, items, unitMap }: { date: string; items: OutgoingStock[]; unitMap: Record<number, UnitConfig> }) {
  const { tf } = useT();
  const [isOpen, setIsOpen] = useState(false);
  const totalQty = items.reduce((s, i) => s + i.quantity, 0);

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <button type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50 transition-colors"
      >
        <div className="flex items-center gap-2">
          {isOpen
            ? <ChevronDown size={15} className="text-slate-400" />
            : <ChevronRight size={15} className="text-slate-400" />}
          <span className="font-semibold text-slate-800">{formatDisplayDate(date)}</span>
        </div>
        <div className="text-xs text-slate-400 flex items-center gap-1.5">
          <span>{tf<string>('common.itemCount', items.length)}</span>
          <span>·</span>
          <span>{tf<string>('common.totalUnits', totalQty)}</span>
        </div>
      </button>
      {isOpen && (
        <div className="px-4 pb-3 divide-y divide-slate-100">
          {items.map(item => (
            <AllocationItem key={item.id} item={item} unitMap={unitMap} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function LotAllocationList({ items, emptyText, unitMap = {} }: { items: OutgoingStock[]; emptyText: string; unitMap?: Record<number, UnitConfig> }) {
  const { t } = useT();
  const [sortMode, setSortMode] = useState<SortMode>('location');
  const groups = groupByDate(items);
  const sortedItems = sortItems(items, sortMode);

  if (items.length === 0) return <p className="text-slate-400 text-sm">{emptyText}</p>;

  const sortKeys: { mode: SortMode; key: 'shipping.sortByLocation' | 'shipping.sortByExpiry' | 'shipping.sortByLot' }[] = [
    { mode: 'location', key: 'shipping.sortByLocation' },
    { mode: 'expiry', key: 'shipping.sortByExpiry' },
    { mode: 'lot', key: 'shipping.sortByLot' },
  ];

  return (
    <div>
      {/* Controls */}
      <div className="flex items-center justify-between gap-3 mb-2 print:hidden">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-slate-500">{t('shipping.sortLabel')}:</span>
          {sortKeys.map(({ mode, key }) => (
            <button
              key={mode}
              type="button"
              onClick={() => setSortMode(mode)}
              className={`px-2.5 py-1 text-xs rounded-full transition-colors ${
                sortMode === mode
                  ? 'bg-blue-100 text-blue-700 font-medium'
                  : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'
              }`}
            >
              {t(key)}
            </button>
          ))}
        </div>
        <button type="button" onClick={() => window.print()}
          className="px-3 py-1.5 text-sm border border-slate-300 rounded-lg text-slate-600 hover:bg-slate-50 transition-colors shrink-0">
          {t('shipping.printPickingList')}
        </button>
      </div>

      {/* Screen: date groups */}
      <div className="print:hidden space-y-2">
        {groups.map(({ date, items: dateItems }) => (
          <DateGroup key={date} date={date} items={dateItems} unitMap={unitMap} />
        ))}
      </div>

      {/* Print: picking list */}
      <div className="hidden print:block text-sm">
        <h1 className="text-xl font-bold text-slate-800 mb-4">{t('shipping.pickingList')}</h1>
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="bg-slate-100">
              <th className="border border-slate-300 px-2 py-1 text-left">{t('shipping.pickingDate')}</th>
              <th className="border border-slate-300 px-2 py-1 text-left">{t('shipping.pickingProduct')}</th>
              <th className="border border-slate-300 px-2 py-1 text-left">{t('shipping.pickingLot')}</th>
              <th className="border border-slate-300 px-2 py-1 text-left">{t('inventory.lotExpiry')}</th>
              <th className="border border-slate-300 px-2 py-1 text-left">{t('shipping.pickingLocation')}</th>
              <th className="border border-slate-300 px-2 py-1 text-right">{t('shipping.pickingQty')}</th>
              <th className="border border-slate-300 px-2 py-1 text-left">{t('shipping.destination')}</th>
            </tr>
          </thead>
          <tbody>
            {sortedItems.map((item, i) => (
              <tr key={i} className="border-b border-slate-200">
                <td className="border border-slate-300 px-2 py-1">{formatDisplayDate(item.scheduled_date)}</td>
                <td className="border border-slate-300 px-2 py-1">{item.product_name}</td>
                <td className="border border-slate-300 px-2 py-1 font-mono">{item.lot_number ?? '—'}</td>
                <td className="border border-slate-300 px-2 py-1">{item.expiry_date ? formatDisplayDate(item.expiry_date) : '—'}</td>
                <td className="border border-slate-300 px-2 py-1">
                  {[item.warehouse_name, item.location_name].filter(Boolean).join(' / ') || '—'}
                </td>
                <td className="border border-slate-300 px-2 py-1 text-right tabular-nums">{item.quantity}</td>
                <td className="border border-slate-300 px-2 py-1">{item.destination_name ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
