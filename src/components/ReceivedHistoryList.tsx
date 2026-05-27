'use client';

import { useState, useActionState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import type { IncomingStock } from '@/lib/db';
import LotTag from './LotTag';
import { useT } from './LanguageProvider';
import { formatQty } from '@/lib/units';
import type { UnitConfig } from '@/lib/units';
import { unreceiveIncoming } from '@/lib/actions';
import { formatDisplayDate } from '@/lib/tz';
import { useActionFeedback } from '@/hooks/useActionFeedback';

function Item({ item, today, unitConfig }: { item: IncomingStock; today: string; unitConfig: UnitConfig }) {
  const { t, lang } = useT();
  const [confirming, setConfirming] = useState(false);
  const [state, action] = useActionState(unreceiveIncoming, null);
  const { errorMsg } = useActionFeedback(state, '');

  return (
    <div className="py-2.5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2">
            <span className="text-sm font-bold text-slate-800">{item.product_name}</span>
            {unitConfig.pieces_per_ball ? (
              <span className="text-xs text-slate-500">{formatQty(item.quantity, unitConfig, lang)} ({item.quantity}{t('units.pieceSuffix')})</span>
            ) : (
              <span className="text-xs text-slate-500">{item.quantity} {t('incoming.units')}</span>
            )}
          </div>
          {item.lot_number && (
            <div className="mt-0.5">
              <LotTag
                lotNumber={item.lot_number}
                expiryDate={item.expiry_date}
                today={today}
                expiryLabel={t('inventory.lotExpiry')}
              />
            </div>
          )}
          <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
            {item.expected_date && (
              <span className="text-xs text-slate-400">{t('incoming.expectedDate2')} {formatDisplayDate(item.expected_date)}</span>
            )}
            {item.supplier_name && (
              <span className="text-xs text-slate-400">{t('incoming.supplier')}: {item.supplier_name}</span>
            )}
            {item.warehouse_name && (
              <span className="text-xs text-slate-400">{t('incoming.warehouseScheduled')}: {item.warehouse_name}</span>
            )}
            {item.location_name && (
              <span className="text-xs text-slate-400">{t('incoming.location')}: {item.location_name}</span>
            )}
          </div>
          {errorMsg && <p className="text-red-600 text-xs mt-0.5">{errorMsg}</p>}
        </div>
        {confirming ? (
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <span className="text-xs text-slate-500">{t('common.undoQuestion')}</span>
            <button type="button" onClick={() => setConfirming(false)}
              className="text-xs text-slate-400 hover:text-slate-600 px-2 py-1 rounded">
              {t('common.cancel')}
            </button>
            <form action={action}>
              <input type="hidden" name="id" value={item.id} />
              <button type="submit" className="text-xs text-orange-600 hover:text-orange-700 font-medium px-2 py-1 rounded">
                {t('common.undo')}
              </button>
            </form>
          </div>
        ) : (
          <div className="flex items-center gap-2 flex-shrink-0">
            <button type="button" onClick={() => setConfirming(true)}
              className="text-xs text-slate-400 hover:text-orange-600 px-2 py-1.5 rounded-lg hover:bg-orange-50 transition-colors">
              {t('common.undo')}
            </button>
            <span className="text-xs text-green-600 font-medium">{t('incoming.receivedLabel')}</span>
          </div>
        )}
      </div>
    </div>
  );
}

function groupByExpectedDate(items: IncomingStock[]): { date: string; items: IncomingStock[] }[] {
  const map = new Map<string, IncomingStock[]>();
  for (const item of items) {
    const date = item.expected_date ?? item.received_at?.slice(0, 10) ?? 'unknown';
    const arr = map.get(date) ?? [];
    arr.push(item);
    map.set(date, arr);
  }
  const entries = Array.from(map.entries()).map(([date, its]) => ({ date, items: its }));
  entries.sort((a, b) => b.date.localeCompare(a.date));
  return entries;
}

export default function ReceivedHistoryList({ items, emptyText, unitMap = {} }: { items: IncomingStock[]; emptyText: string; unitMap?: Record<number, UnitConfig> }) {
  const { tf } = useT();
  const { localDate } = useT();
  const [today] = useState(() => localDate());

  const groups = groupByExpectedDate(items);
  const [threshold] = useState(() => {
    const now = new Date();
    return new Date(now.getTime() - 10 * 60 * 1000).toISOString();
  });
  const defaultOpen = new Set(groups.slice(0, 2).map((g) => g.date));
  const recentlyConfirmed = new Set(
    items
      .filter((i) => i.received_at && i.received_at > threshold)
      .map((i) => i.expected_date ?? i.received_at!.slice(0, 10))
  );
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  if (items.length === 0) return <p className="text-slate-400 text-sm">{emptyText}</p>;

  return (
    <div className="space-y-2">
      {groups.map(({ date, items: dateItems }) => {
        const totalQty = dateItems.reduce((s, i) => s + i.quantity, 0);
        const isOpen = date in expanded ? expanded[date] : (recentlyConfirmed.has(date) || defaultOpen.has(date));
        return (
          <div key={date} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <button
              type="button"
              onClick={() => setExpanded((prev) => ({ ...prev, [date]: !isOpen }))}
              className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50 transition-colors"
            >
              <div className="flex items-center gap-2">
                {isOpen
                  ? <ChevronDown size={15} className="text-slate-400" />
                  : <ChevronRight size={15} className="text-slate-400" />}
                <span className="font-semibold text-slate-800">{formatDisplayDate(date)}</span>
              </div>
              <div className="text-xs text-slate-400 flex items-center gap-1.5">
                <span>{tf<string>('common.itemCount', dateItems.length)}</span>
                <span>·</span>
                <span>{tf<string>('common.totalUnits', totalQty)}</span>
              </div>
            </button>
            {isOpen && (
              <div className="px-4 pb-2 divide-y divide-slate-100">
                {dateItems.map((item) => (
                  <Item key={item.id} item={item} today={today} unitConfig={unitMap[item.product_id] ?? { pieces_per_ball: null, balls_per_case: null, cases_per_pallet: null }} />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
