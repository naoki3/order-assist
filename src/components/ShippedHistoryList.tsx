'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import type { OutgoingStock } from '@/lib/db';
import LotTag from './LotTag';
import { useT } from './LanguageProvider';
import { formatQty } from '@/lib/units';
import type { UnitConfig } from '@/lib/units';

function Item({ item, today, unitConfig }: { item: OutgoingStock; today: string; unitConfig: UnitConfig }) {
  const { t } = useT();
  return (
    <div className="py-2.5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="text-sm font-bold text-slate-800">{item.product_name}</span>
            {unitConfig.pieces_per_ball ? (
              <span className="text-xs text-slate-500">{formatQty(item.quantity, unitConfig)}</span>
            ) : (
              <span className="text-xs text-slate-500">{item.quantity} {t('shipping.units')}</span>
            )}
            {item.note && <span className="text-xs text-slate-400">· {item.note}</span>}
          </div>
          {item.lot_number && (
            <div className="mt-0.5">
              <LotTag lotNumber={item.lot_number} expiryDate={null} today={today} />
            </div>
          )}
          <p className="text-xs text-slate-400 mt-0.5">
            {t('shipping.scheduledDate')} {item.scheduled_date}
          </p>
        </div>
        <span className="text-xs text-blue-600 font-medium shrink-0">{t('shipping.confirmed')}</span>
      </div>
    </div>
  );
}

function groupByScheduledDate(items: OutgoingStock[]): { date: string; items: OutgoingStock[] }[] {
  const map = new Map<string, OutgoingStock[]>();
  for (const item of items) {
    const date = item.scheduled_date ?? item.shipped_at?.slice(0, 10) ?? 'unknown';
    const arr = map.get(date) ?? [];
    arr.push(item);
    map.set(date, arr);
  }
  const entries = Array.from(map.entries()).map(([date, its]) => ({ date, items: its }));
  entries.sort((a, b) => b.date.localeCompare(a.date));
  return entries;
}

export default function ShippedHistoryList({ items, emptyText, unitMap = {} }: { items: OutgoingStock[]; emptyText: string; unitMap?: Record<number, UnitConfig> }) {
  const { tf } = useT();
  const { localDate } = useT();
  const [today] = useState(() => localDate());
  const groups = groupByScheduledDate(items);
  const [threshold] = useState(() => {
    const now = new Date();
    return new Date(now.getTime() - 10 * 60 * 1000).toISOString();
  });
  const defaultOpen = new Set(groups.slice(0, 2).map((g) => g.date));
  const recentlyConfirmed = new Set(
    items
      .filter((i) => i.shipped_at && i.shipped_at > threshold)
      .map((i) => i.scheduled_date ?? i.shipped_at!.slice(0, 10))
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
                <span className="font-semibold text-slate-800">{date}</span>
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
