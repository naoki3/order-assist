'use client';

import { useState, useActionState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import type { OutgoingStock } from '@/lib/db';
import { confirmShipment, deleteOutgoingSchedule, confirmBulkShipment, deallocateOutgoing } from '@/lib/actions';
import { useT } from './LanguageProvider';
import { useActionFeedback } from '@/hooks/useActionFeedback';
import { formatQty } from '@/lib/units';
import type { UnitConfig } from '@/lib/units';
import { formatDisplayDate } from '@/lib/tz';

function Item({ item, unitConfig }: { item: OutgoingStock; unitConfig: UnitConfig }) {
  const { t, lang } = useT();
  const [confirming, setConfirming] = useState(false);
  const [shipState, shipAction] = useActionState(confirmShipment, null);
  const [delState, delAction] = useActionState(deleteOutgoingSchedule, null);
  const [deallocState, deallocAction] = useActionState(deallocateOutgoing, null);

  const { successMsg: shipSuccess, errorMsg: shipError } = useActionFeedback(shipState, t('common.confirmed'));
  const { errorMsg: delError } = useActionFeedback(delState, t('common.deleted'));
  const { errorMsg: deallocError } = useActionFeedback(deallocState, '');

  return (
    <div className="py-2.5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-1 flex-wrap">
            <span className="text-sm font-medium text-slate-800">{item.product_name}</span>
            {unitConfig.pieces_per_ball ? (
              <span className="text-xs text-slate-500">{formatQty(item.quantity, unitConfig, lang)}</span>
            ) : (
              <span className="text-xs text-slate-500">{item.quantity} {t('shipping.units')}</span>
            )}
            {item.note && <span className="text-xs text-slate-400">· {item.note}</span>}
          </div>
          <div className="flex flex-wrap gap-x-2 gap-y-0.5 mt-0.5">
            {item.lot_number && (
              <span className="text-xs font-mono text-slate-600">{t('shipping.pickingLot')}: {item.lot_number}</span>
            )}
            {item.expiry_date && (
              <span className="text-xs text-slate-500">{t('inventory.lotExpiry')}: {formatDisplayDate(item.expiry_date)}</span>
            )}
            {item.warehouse_name && <span className="text-xs text-slate-400">{t('incoming.warehouseScheduled')}: {item.warehouse_name}</span>}
            {item.location_name && <span className="text-xs text-slate-400">{t('inventory.location')}: {item.location_name}</span>}
            {item.destination_name && <span className="text-xs text-slate-400">{t('shipping.destination')}: {item.destination_name}</span>}
            {item.carrier_name && <span className="text-xs text-slate-400">{t('shipping.carrier')}: {item.carrier_name}</span>}
          </div>
          {shipError && <p className="text-red-600 text-xs mt-0.5">{shipError}</p>}
          {delError && <p className="text-red-600 text-xs mt-0.5">{delError}</p>}
          {deallocError && <p className="text-red-600 text-xs mt-0.5">{deallocError}</p>}
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
                className="px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 transition-colors">
                {t('shipping.confirm')}
              </button>
            </form>
            <form action={deallocAction}>
              <input type="hidden" name="id" value={item.id} />
              <button type="submit"
                className="text-amber-600 text-xs hover:text-amber-700 px-2 py-1.5 rounded-lg hover:bg-amber-50 transition-colors">
                {t('shipping.btnDeallocate')}
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

function DateGroup({ date, items, unitMap, today }: { date: string; items: OutgoingStock[]; unitMap: Record<number, UnitConfig>; today: string }) {
  const { t, tf } = useT();
  const [isOpen, setIsOpen] = useState(date === today);
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
          <span className="font-semibold text-slate-800">{formatDisplayDate(date)}</span>
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

export default function OutgoingConfirmList({ items, emptyText, unitMap = {}, today = '' }: { items: OutgoingStock[]; emptyText: string; unitMap?: Record<number, UnitConfig>; today?: string }) {
  const { t } = useT();
  const groups = groupByDate(items);

  if (items.length === 0) return <p className="text-slate-400 text-sm">{emptyText}</p>;

  return (
    <div>
      {/* ピッキングリスト印刷ボタン */}
      <div className="flex justify-end mb-2 print:hidden">
        <button type="button" onClick={() => window.print()}
          className="px-3 py-1.5 text-sm border border-slate-300 rounded-lg text-slate-600 hover:bg-slate-50 transition-colors">
          {t('shipping.printPickingList')}
        </button>
      </div>

      {/* 画面表示: 日付グループ */}
      <div className="print:hidden space-y-2">
        {groups.map(({ date, items: dateItems }) => (
          <DateGroup key={date} date={date} items={dateItems} unitMap={unitMap} today={today} />
        ))}
      </div>

      {/* 印刷用ピッキングリスト */}
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
            {items.map((item, i) => (
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
