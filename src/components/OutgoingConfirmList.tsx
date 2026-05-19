'use client';

import { useState, useActionState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import type { OutgoingStock } from '@/lib/db';
import { confirmShipment, deleteOutgoingSchedule, confirmBulkShipment } from '@/lib/actions';
import { useT } from './LanguageProvider';
import { useActionFeedback } from '@/hooks/useActionFeedback';
import { formatQty } from '@/lib/units';
import type { UnitConfig } from '@/lib/units';

function Item({ item, unitConfig }: { item: OutgoingStock; unitConfig: UnitConfig }) {
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
          {unitConfig.pieces_per_ball ? (
            <span className="text-xs text-slate-500 ml-2">{formatQty(item.quantity, unitConfig)}</span>
          ) : (
            <span className="text-xs text-slate-500 ml-2">{item.quantity} {t('shipping.units')}</span>
          )}
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

function DateGroup({ date, items, unitMap }: { date: string; items: OutgoingStock[]; unitMap: Record<number, UnitConfig> }) {
  const { t, tf } = useT();
  const [isOpen, setIsOpen] = useState(true);
  const [bulkState, bulkAction] = useActionState(confirmBulkShipment, null);
  const { successMsg, errorMsg } = useActionFeedback(bulkState, t('common.confirmed'));
  const totalQty = items.reduce((s, i) => s + i.quantity, 0);

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <button type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50 transition-colors">
        <div className="flex items-center gap-2">
          {isOpen
            ? <ChevronDown size={15} className="text-slate-400" />
            : <ChevronRight size={15} className="text-slate-400" />}
          <span className="font-semibold text-slate-800">{date}</span>
        </div>
        <div className="text-xs text-slate-400 flex items-center gap-1.5">
          <span>{tf<string>('common.itemCount', items.length)}</span>
          <span>·</span>
          <span>{tf<string>('common.totalUnits', totalQty)}</span>
        </div>
      </button>
      {isOpen && (
        <div className="px-4 pb-3">
          <div className="divide-y divide-slate-100">
            {items.map(item => <Item key={item.id} item={item} unitConfig={unitMap[item.product_id] ?? { pieces_per_ball: null, balls_per_case: null, cases_per_pallet: null }} />)}
          </div>
          {errorMsg && <p className="text-red-600 text-xs pt-2">{errorMsg}</p>}
          {successMsg && <p className="text-green-600 text-xs pt-2">{successMsg}</p>}
          <form action={bulkAction} className="pt-2">
            <input type="hidden" name="ids" value={JSON.stringify(items.map(i => i.id))} />
            <button type="submit"
              className="w-full py-2 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors">
              {tf<string>('common.bulkConfirm', items.length)}
            </button>
          </form>
        </div>
      )}
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

export default function OutgoingConfirmList({ items, emptyText, unitMap = {} }: { items: OutgoingStock[]; emptyText: string; unitMap?: Record<number, UnitConfig> }) {
  const groups = groupByDate(items);
  if (items.length === 0) return <p className="text-slate-400 text-sm">{emptyText}</p>;
  return (
    <div className="space-y-2">
      {groups.map(({ date, items: dateItems }) => (
        <DateGroup key={date} date={date} items={dateItems} unitMap={unitMap} />
      ))}
    </div>
  );
}
