'use client';

import { useState, useActionState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import type { OutgoingStock } from '@/lib/db';
import LotTag from './LotTag';
import { useT } from './LanguageProvider';
import { formatQty } from '@/lib/units';
import type { UnitConfig } from '@/lib/units';
import { unshipOutgoing } from '@/lib/actions';
import { formatDisplayDate } from '@/lib/tz';
import { useActionFeedback } from '@/hooks/useActionFeedback';

function Item({ item, today, unitConfig }: { item: OutgoingStock; today: string; unitConfig: UnitConfig }) {
  const { t, lang } = useT();
  const [confirming, setConfirming] = useState(false);
  const [state, action] = useActionState(unshipOutgoing, null);
  const { errorMsg } = useActionFeedback(state, '');

  return (
    <div className="py-2.5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="text-sm font-bold text-slate-800">{item.product_name}</span>
            {unitConfig.pieces_per_ball ? (
              <span className="text-xs text-slate-500">{formatQty(item.quantity, unitConfig, lang)} ({item.quantity}{t('units.pieceSuffix')})</span>
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
          <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
            <span className="text-xs text-slate-400">{t('shipping.scheduledDate')} {formatDisplayDate(item.scheduled_date)}</span>
            {item.destination_name && (
              <span className="text-xs text-slate-400">{t('shipping.destination')}: {item.destination_name}</span>
            )}
            {item.carrier_name && (
              <span className="text-xs text-slate-400">{t('shipping.carrier')}: {item.carrier_name}</span>
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
            <span className="text-xs text-blue-600 font-medium">{t('shipping.confirmed')}</span>
          </div>
        )}
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

interface DeliveryGroup {
  date: string;
  destination: string | null;
  carrier: string | null;
  items: OutgoingStock[];
}

function buildDeliveryGroups(items: OutgoingStock[]): DeliveryGroup[] {
  const map = new Map<string, DeliveryGroup>();
  for (const item of items) {
    const shippedDate = item.shipped_at?.slice(0, 10) ?? item.scheduled_date;
    const key = `${shippedDate}||${item.destination_name ?? ''}||${item.carrier_name ?? ''}`;
    if (!map.has(key)) {
      map.set(key, { date: shippedDate, destination: item.destination_name, carrier: item.carrier_name, items: [] });
    }
    map.get(key)!.items.push(item);
  }
  return Array.from(map.values()).sort((a, b) => b.date.localeCompare(a.date));
}

export default function ShippedHistoryList({ items, emptyText, unitMap = {} }: { items: OutgoingStock[]; emptyText: string; unitMap?: Record<number, UnitConfig> }) {
  const { t, tf } = useT();
  const { localDate } = useT();
  const [today] = useState(() => localDate());
  const groups = groupByScheduledDate(items);
  const deliveryGroups = buildDeliveryGroups(items);
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
    <div>
      {/* Print button — screen only */}
      <div className="flex justify-end mb-2 print:hidden">
        <button type="button" onClick={() => window.print()}
          className="px-3 py-1.5 text-sm border border-slate-300 rounded-lg text-slate-600 hover:bg-slate-50 transition-colors">
          {t('shipping.printDeliveryNote')}
        </button>
      </div>

      {/* Regular shipped list — hidden when printing */}
      <div className="print:hidden space-y-2">
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

      {/* Delivery note — print only */}
      <div className="hidden print:block text-sm">
        <h1 className="text-xl font-bold text-slate-800 mb-6">{t('shipping.deliveryNote')}</h1>
        {deliveryGroups.map((group, gi) => (
          <div key={gi} className="mb-8">
            <div className="border-b-2 border-slate-800 pb-1 mb-3">
              <p className="font-semibold text-slate-800">
                {t('shipping.deliveryNoteShippedDate')}: {formatDisplayDate(group.date)}
              </p>
              {group.destination && (
                <p className="text-slate-600">{t('shipping.deliveryNoteDestination')}: {group.destination}</p>
              )}
              {group.carrier && (
                <p className="text-slate-600">{t('shipping.deliveryNoteCarrier')}: {group.carrier}</p>
              )}
            </div>
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100">
                  <th className="border border-slate-300 px-2 py-1 text-left">{t('shipping.pickingProduct')}</th>
                  <th className="border border-slate-300 px-2 py-1 text-left">{t('shipping.deliveryNoteLot')}</th>
                  <th className="border border-slate-300 px-2 py-1 text-right">{t('shipping.deliveryNoteQty')}</th>
                </tr>
              </thead>
              <tbody>
                {group.items.map((item, ii) => (
                  <tr key={ii} className="border-b border-slate-200">
                    <td className="border border-slate-300 px-2 py-1">{item.product_name}</td>
                    <td className="border border-slate-300 px-2 py-1 font-mono">{item.lot_number ?? '—'}</td>
                    <td className="border border-slate-300 px-2 py-1 text-right">{item.quantity}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-slate-50">
                  <td className="border border-slate-300 px-2 py-1 font-semibold" colSpan={2}></td>
                  <td className="border border-slate-300 px-2 py-1 text-right font-bold">
                    {group.items.reduce((s, i) => s + i.quantity, 0)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        ))}
      </div>
    </div>
  );
}
