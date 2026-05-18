'use client';

import { useState, useActionState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import type { OutgoingStock } from '@/lib/db';
import { confirmShipment, deleteOutgoingSchedule } from '@/lib/actions';
import { useT } from './LanguageProvider';
import { useActionFeedback } from '@/hooks/useActionFeedback';

function Item({ item }: { item: OutgoingStock }) {
  const { t } = useT();
  const [confirming, setConfirming] = useState(false);
  const [shipState, shipAction] = useActionState(confirmShipment, null);
  const [delState, delAction] = useActionState(deleteOutgoingSchedule, null);

  const { successMsg: shipSuccess, errorMsg: shipError } = useActionFeedback(shipState, t('common.confirmed'));
  const { errorMsg: delError } = useActionFeedback(delState, t('common.deleted'));

  return (
    <div className="py-2.5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex-1 min-w-0">
          <span className="text-sm font-medium text-slate-800">{item.product_name}</span>
          <span className="text-xs text-slate-500 ml-2">{item.quantity} {t('shipping.units')}</span>
          {item.note && <span className="text-xs text-slate-400 ml-1">· {item.note}</span>}
          {shipError && <p className="text-red-600 text-xs mt-0.5">{shipError}</p>}
          {delError && <p className="text-red-600 text-xs mt-0.5">{delError}</p>}
          {shipSuccess && <p className="text-green-600 text-xs mt-0.5">{shipSuccess}</p>}
        </div>
        {confirming ? (
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <span className="text-xs text-slate-500">{t('common.confirmQuestion')}</span>
            <button type="button" onClick={() => setConfirming(false)}
              className="text-xs text-slate-400 hover:text-slate-600 px-2 py-1 rounded">
              {t('common.cancel')}
            </button>
            <form action={delAction}>
              <input type="hidden" name="id" value={item.id} />
              <button type="submit" className="text-xs text-red-600 hover:text-red-700 font-medium px-2 py-1 rounded">
                {t('shipping.delete')}
              </button>
            </form>
          </div>
        ) : (
          <div className="flex items-center gap-2 flex-shrink-0">
            <form action={shipAction}>
              <input type="hidden" name="id" value={item.id} />
              <button type="submit"
                className="px-3 py-1.5 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700 transition-colors">
                {t('shipping.confirm')}
              </button>
            </form>
            <button type="button" onClick={() => setConfirming(true)}
              className="text-red-400 text-xs hover:text-red-600 px-2 py-1.5 rounded-lg hover:bg-red-50 transition-colors">
              {t('shipping.delete')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function groupByDate(items: OutgoingStock[]) {
  const map = new Map<string, OutgoingStock[]>();
  for (const item of items) {
    const arr = map.get(item.scheduled_date) ?? [];
    arr.push(item);
    map.set(item.scheduled_date, arr);
  }
  return Array.from(map.entries()).map(([date, its]) => ({ date, items: its }));
}

export default function OutgoingConfirmList({ items, emptyText }: { items: OutgoingStock[]; emptyText: string }) {
  const { tf } = useT();
  const groups = groupByDate(items);
  const [expanded, setExpanded] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(groups.map(g => [g.date, true]))
  );

  if (items.length === 0) return <p className="text-slate-400 text-sm">{emptyText}</p>;

  return (
    <div className="space-y-2">
      {groups.map(({ date, items: dateItems }) => {
        const totalQty = dateItems.reduce((s, i) => s + i.quantity, 0);
        const isOpen = expanded[date] ?? true;
        return (
          <div key={date} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <button type="button"
              onClick={() => setExpanded(prev => ({ ...prev, [date]: !isOpen }))}
              className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50 transition-colors">
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
                {dateItems.map(item => <Item key={item.id} item={item} />)}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
