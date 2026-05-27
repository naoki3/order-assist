'use client';

import { useActionState } from 'react';
import type { OutgoingStock, Lot } from '@/lib/db';
import { useT } from './LanguageProvider';
import { formatQty } from '@/lib/units';
import type { UnitConfig } from '@/lib/units';
import { formatDisplayDate } from '@/lib/tz';
import { allocateOutgoing, allocateBulkOutgoing } from '@/lib/actions';
import { useActionFeedback } from '@/hooks/useActionFeedback';

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

function AllocationItem({
  item,
  suggestedLot,
  unitMap,
}: {
  item: OutgoingStock;
  suggestedLot: Lot | undefined;
  unitMap: Record<number, UnitConfig>;
}) {
  const { t, lang } = useT();
  const unitConfig = unitMap[item.product_id] ?? { pieces_per_ball: null, balls_per_case: null, cases_per_pallet: null };
  const [allocState, allocAction] = useActionState(allocateOutgoing, null);
  const { errorMsg } = useActionFeedback(allocState, '');

  return (
    <div className="py-2.5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-1.5 flex-wrap">
            <span className="text-sm font-medium text-slate-800">{item.product_name}</span>
            {unitConfig.pieces_per_ball ? (
              <span className="text-xs text-slate-500">
                {formatQty(item.quantity, unitConfig, lang)} ({item.quantity}{t('units.pieceSuffix')})
              </span>
            ) : (
              <span className="text-xs text-slate-500">{item.quantity} {t('shipping.units')}</span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5">
            <span className="text-xs text-slate-400">{t('shipping.suggestedLot')}:</span>
            {suggestedLot ? (
              <span className="text-xs font-mono text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">
                {suggestedLot.lot_number}
                {suggestedLot.expiry_date && ` (${formatDisplayDate(suggestedLot.expiry_date)})`}
                {suggestedLot.location_name && ` · ${suggestedLot.location_name}`}
              </span>
            ) : (
              <span className="text-xs text-red-500">{t('shipping.noLotAvailable')}</span>
            )}
            {item.destination_name && (
              <span className="text-xs text-slate-400">{t('shipping.destination')}: {item.destination_name}</span>
            )}
          </div>
          {errorMsg && <p className="text-red-600 text-xs mt-0.5">{errorMsg}</p>}
        </div>
        {suggestedLot && (
          <form action={allocAction} className="flex-shrink-0">
            <input type="hidden" name="id" value={item.id} />
            <button
              type="submit"
              className="px-3 py-1.5 bg-emerald-600 text-white text-xs font-medium rounded-lg hover:bg-emerald-700 transition-colors"
            >
              {t('shipping.btnAllocate')}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

export default function LotAllocationList({
  items,
  emptyText,
  unitMap = {},
  lotsMap = {},
}: {
  items: OutgoingStock[];
  emptyText: string;
  unitMap?: Record<number, UnitConfig>;
  lotsMap?: Record<number, Lot[]>;
}) {
  const { tf } = useT();
  const [bulkState, bulkAction] = useActionState(allocateBulkOutgoing, null);
  const { errorMsg: bulkError } = useActionFeedback(bulkState, '');

  if (items.length === 0) return <p className="text-slate-400 text-sm">{emptyText}</p>;

  const groups = groupByDate(items);
  const allocatableIds = items.filter(i => (lotsMap[i.product_id] ?? []).length > 0).map(i => i.id);

  return (
    <div>
      {/* 全件引当ボタン */}
      {allocatableIds.length > 0 && (
        <div className="mb-3 print:hidden">
          {bulkError && <p className="text-red-600 text-xs mb-1">{bulkError}</p>}
          <form action={bulkAction}>
            <input type="hidden" name="ids" value={JSON.stringify(allocatableIds)} />
            <button
              type="submit"
              className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors"
            >
              {tf<string>('shipping.btnAllocateAll', allocatableIds.length)}
            </button>
          </form>
        </div>
      )}

      {/* 日付グループ */}
      <div className="space-y-2">
        {groups.map(({ date, items: dateItems }) => (
          <div key={date} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
              <span className="font-semibold text-slate-800">{formatDisplayDate(date)}</span>
              <span className="text-xs text-slate-400">{tf<string>('common.itemCount', dateItems.length)}</span>
            </div>
            <div className="px-4 pb-3 divide-y divide-slate-100">
              {dateItems.map(item => (
                <AllocationItem
                  key={item.id}
                  item={item}
                  suggestedLot={lotsMap[item.product_id]?.[0]}
                  unitMap={unitMap}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
