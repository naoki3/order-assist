'use client';

import { useState, useActionState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import type { IncomingStock } from '@/lib/db';
import { receiveIncoming, deleteIncomingSchedule, receiveBulkIncoming } from '@/lib/actions';
import { useT } from './LanguageProvider';
import { useActionFeedback } from '@/hooks/useActionFeedback';
import { formatQty } from '@/lib/units';
import type { UnitConfig } from '@/lib/units';
import DateInput from './DateInput';

function Item({ item, unitConfig }: { item: IncomingStock; unitConfig: UnitConfig }) {
  const { t } = useT();
  const [confirming, setConfirming] = useState(false);
  const [receiveState, receiveAction] = useActionState(receiveIncoming, null);
  const [delState, delAction] = useActionState(deleteIncomingSchedule, null);

  const { successMsg: receiveSuccess, errorMsg: receiveError } = useActionFeedback(receiveState, t('common.received'));
  const { errorMsg: delError } = useActionFeedback(delState, t('common.deleted'));

  return (
    <div className="py-2.5 space-y-2">
      <div className="flex items-center justify-between gap-3">
        <div className="flex-1 min-w-0">
          <span className="text-sm font-medium text-slate-800">{item.product_name}</span>
          {unitConfig.pieces_per_ball ? (
            <span className="text-xs text-slate-500 ml-2">{formatQty(item.quantity, unitConfig)}</span>
          ) : (
            <span className="text-xs text-slate-500 ml-2">{item.quantity} {t('incoming.units')}</span>
          )}
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
                {t('incoming.delete')}
              </button>
            </form>
          </div>
        ) : (
          <button type="button" onClick={() => setConfirming(true)}
            className="text-red-400 text-xs hover:text-red-600 px-2 py-1.5 rounded-lg hover:bg-red-50 transition-colors flex-shrink-0">
            {t('incoming.delete')}
          </button>
        )}
      </div>
      {!confirming && (
        <form action={receiveAction} className="flex flex-wrap gap-2">
          <input type="hidden" name="id" value={item.id} />
          <input type="text" name="lot_number" defaultValue={item.lot_number ?? ''}
            placeholder={t('incoming.lotPlaceholder')}
            className="flex-1 min-w-32 border border-slate-300 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-green-500" />
          <label className="flex-1 min-w-32 flex flex-col gap-0.5">
            <span className="text-xs text-slate-500">{t('incoming.expiryDate')}</span>
            <DateInput name="expiry_date" defaultValue={item.expiry_date ?? ''} className="w-full text-xs" />
          </label>
          <button type="submit"
            className="px-3 py-1.5 bg-green-600 text-white text-xs rounded-lg hover:bg-green-700 transition-colors font-medium self-end">
            {t('incoming.markReceived')}
          </button>
        </form>
      )}
      {receiveError && <p className="text-red-600 text-xs">{receiveError}</p>}
      {delError && <p className="text-red-600 text-xs">{delError}</p>}
      {receiveSuccess && <p className="text-green-600 text-xs">{receiveSuccess}</p>}
    </div>
  );
}

function DateGroup({ date, items, unitMap }: { date: string; items: IncomingStock[]; unitMap: Record<number, UnitConfig> }) {
  const { t, tf } = useT();
  const [isOpen, setIsOpen] = useState(true);
  const [bulkState, bulkAction] = useActionState(receiveBulkIncoming, null);
  const { successMsg, errorMsg } = useActionFeedback(bulkState, t('common.received'));
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
              className="w-full py-2 text-xs font-medium text-green-700 bg-green-50 hover:bg-green-100 rounded-lg transition-colors">
              {tf<string>('common.bulkConfirm', items.length)}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

function groupByDate(items: IncomingStock[]) {
  const map = new Map<string, IncomingStock[]>();
  for (const item of items) {
    const arr = map.get(item.expected_date) ?? [];
    arr.push(item);
    map.set(item.expected_date, arr);
  }
  return Array.from(map.entries()).map(([date, its]) => ({ date, items: its }));
}

export default function IncomingConfirmList({ items, emptyText, unitMap = {} }: { items: IncomingStock[]; emptyText: string; unitMap?: Record<number, UnitConfig> }) {
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
