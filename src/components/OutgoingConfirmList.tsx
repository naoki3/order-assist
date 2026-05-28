'use client';

import { useState, useActionState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import type { ShipmentWithLines, ShipmentLine } from '@/lib/db';
import { confirmShipment, deleteOutgoingSchedule, deallocateOutgoing } from '@/lib/actions';
import { useT } from './LanguageProvider';
import { useActionFeedback } from '@/hooks/useActionFeedback';
import { formatQty } from '@/lib/units';
import type { UnitConfig } from '@/lib/units';
import { formatDisplayDate } from '@/lib/tz';

function ShipmentLineRow({ line, unitConfig }: { line: ShipmentLine; unitConfig: UnitConfig }) {
  const { t, lang } = useT();
  const [deallocState, deallocAction] = useActionState(deallocateOutgoing, null);
  const { errorMsg: deallocError } = useActionFeedback(deallocState, '');

  return (
    <div className="py-2 flex items-center justify-between gap-3">
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-1 flex-wrap">
          <span className="text-sm font-medium text-slate-800">{line.product_name}</span>
          {unitConfig.pieces_per_ball ? (
            <span className="text-xs text-slate-500">{formatQty(line.quantity, unitConfig, lang)}</span>
          ) : (
            <span className="text-xs text-slate-500">{line.quantity} {t('shipping.units')}</span>
          )}
          {line.note && <span className="text-xs text-slate-400">· {line.note}</span>}
        </div>
        <div className="flex flex-wrap gap-x-2 gap-y-0.5 mt-0.5">
          {line.lot_number && (
            <span className="text-xs font-mono text-slate-600">{t('shipping.pickingLot')}: {line.lot_number}</span>
          )}
          {line.expiry_date && (
            <span className="text-xs text-slate-500">{t('inventory.lotExpiry')}: {formatDisplayDate(line.expiry_date)}</span>
          )}
          {line.warehouse_name && <span className="text-xs text-slate-400">{t('incoming.warehouseScheduled')}: {line.warehouse_name}</span>}
          {line.location_name && <span className="text-xs text-slate-400">{t('inventory.location')}: {line.location_name}</span>}
        </div>
        {deallocError && <p className="text-red-600 text-xs mt-0.5">{deallocError}</p>}
      </div>
      {line.allocated_at && (
        <form action={deallocAction} className="flex-shrink-0">
          <input type="hidden" name="id" value={line.id} />
          <button type="submit"
            className="text-amber-600 text-xs hover:text-amber-700 px-2 py-1.5 rounded-lg hover:bg-amber-50 transition-colors">
            {t('shipping.btnDeallocate')}
          </button>
        </form>
      )}
    </div>
  );
}

function ShipmentCard({ shipment, unitMap, today }: { shipment: ShipmentWithLines; unitMap: Record<number, UnitConfig>; today: string }) {
  const { t } = useT();
  const [confirming, setConfirming] = useState(false);
  const [shipState, shipAction] = useActionState(confirmShipment, null);
  const [delState, delAction] = useActionState(deleteOutgoingSchedule, null);

  const { successMsg: shipSuccess, errorMsg: shipError } = useActionFeedback(shipState, t('common.confirmed'));
  const { errorMsg: delError } = useActionFeedback(delState, t('common.deleted'));

  const hasAllocated = shipment.shipment_lines.some((l) => l.allocated_at !== null);
  const isToday = shipment.scheduled_date === today;

  return (
    <div className="bg-slate-50 rounded-lg border border-slate-200 mb-2 overflow-hidden">
      {/* Card header */}
      <div className="flex items-center gap-2 px-3 py-2 bg-white border-b border-slate-100 justify-between flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-slate-500">{t('shipping.shipmentNo')}:</span>
          <span className="font-mono text-xs font-semibold bg-blue-50 text-blue-700 px-2 py-0.5 rounded">
            {shipment.shipment_no}
          </span>
          {shipment.destination_name && (
            <span className="text-xs text-slate-600">{shipment.destination_name}</span>
          )}
          {shipment.carrier_name && (
            <span className="text-xs text-slate-400">{t('shipping.carrier')}: {shipment.carrier_name}</span>
          )}
          <span className="text-xs text-slate-400">{formatDisplayDate(shipment.scheduled_date)}{isToday && ' (今日)'}</span>
          {/* Allocation status badge */}
          {hasAllocated ? (
            <span className="text-xs font-medium text-green-700 bg-green-50 px-1.5 py-0.5 rounded-full">引当済</span>
          ) : (
            <span className="text-xs font-medium text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded-full">未引当</span>
          )}
        </div>
      </div>
      {/* Card body - lines */}
      <div className="px-3 divide-y divide-slate-100">
        {shipment.shipment_lines.map((line) => (
          <ShipmentLineRow
            key={line.id}
            line={line}
            unitConfig={unitMap[line.product_id] ?? { pieces_per_ball: null, balls_per_case: null, cases_per_pallet: null }}
          />
        ))}
      </div>
      {/* Footer */}
      {shipError && <p className="text-red-600 text-xs px-3 pt-1">{shipError}</p>}
      {delError && <p className="text-red-600 text-xs px-3">{delError}</p>}
      {shipSuccess && <p className="text-green-600 text-xs px-3 pt-1">{shipSuccess}</p>}
      <div className="px-3 pb-3 pt-2 flex items-center gap-2">
        {confirming ? (
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-slate-500">{t('common.confirmQuestion')}</span>
            <button type="button" onClick={() => setConfirming(false)}
              className="text-xs text-slate-400 hover:text-slate-600 px-2 py-1 rounded">
              {t('common.cancel')}
            </button>
            <form action={delAction}>
              <input type="hidden" name="id" value={shipment.id} />
              <button type="submit" className="text-xs text-red-600 hover:text-red-700 font-medium px-2 py-1 rounded">
                {t('shipping.delete')}
              </button>
            </form>
          </div>
        ) : (
          <>
            <form action={shipAction}>
              <input type="hidden" name="id" value={shipment.id} />
              <button type="submit"
                className="px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 transition-colors">
                {t('shipping.confirm')}
              </button>
            </form>
            <button type="button" onClick={() => setConfirming(true)}
              className="text-red-400 text-xs hover:text-red-600 px-2 py-1.5 rounded-lg hover:bg-red-50 transition-colors">
              {t('shipping.delete')}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function DateGroup({ date, shipments, unitMap, today }: { date: string; shipments: ShipmentWithLines[]; unitMap: Record<number, UnitConfig>; today: string }) {
  const { t, tf } = useT();
  const [isOpen, setIsOpen] = useState(date === today);
  const totalLines = shipments.reduce((s, sh) => s + sh.shipment_lines.length, 0);

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
          <span>{tf<string>('common.itemCount', shipments.length)}</span>
          <span>·</span>
          <span>{tf<string>('common.totalUnits', totalLines)}</span>
        </div>
      </button>
      {isOpen && (
        <div className="px-4 pb-3">
          <div className="mt-1">
            {shipments.map(shipment => (
              <ShipmentCard key={shipment.id} shipment={shipment} unitMap={unitMap} today={today} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function groupByDate(shipments: ShipmentWithLines[]) {
  const map = new Map<string, ShipmentWithLines[]>();
  for (const s of shipments) {
    const arr = map.get(s.scheduled_date) ?? [];
    arr.push(s);
    map.set(s.scheduled_date, arr);
  }
  return Array.from(map.entries()).map(([date, ss]) => ({ date, shipments: ss })).sort((a, b) => b.date.localeCompare(a.date));
}

export default function OutgoingConfirmList({
  shipments,
  emptyText,
  unitMap = {},
  today = '',
}: {
  shipments: ShipmentWithLines[];
  emptyText: string;
  unitMap?: Record<number, UnitConfig>;
  today?: string;
}) {
  const { t } = useT();
  const groups = groupByDate(shipments);

  if (shipments.length === 0) return <p className="text-slate-400 text-sm">{emptyText}</p>;

  // Flatten all lines for the print picking list
  const allLines = shipments.flatMap((s) =>
    s.shipment_lines.map((l) => ({ ...l, scheduled_date: s.scheduled_date, destination_name: s.destination_name }))
  );

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
        {groups.map(({ date, shipments: dateShipments }) => (
          <DateGroup key={date} date={date} shipments={dateShipments} unitMap={unitMap} today={today} />
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
            {allLines.map((line, i) => (
              <tr key={i} className="border-b border-slate-200">
                <td className="border border-slate-300 px-2 py-1">{formatDisplayDate(line.scheduled_date)}</td>
                <td className="border border-slate-300 px-2 py-1">{line.product_name}</td>
                <td className="border border-slate-300 px-2 py-1 font-mono">{line.lot_number ?? '—'}</td>
                <td className="border border-slate-300 px-2 py-1">{line.expiry_date ? formatDisplayDate(line.expiry_date) : '—'}</td>
                <td className="border border-slate-300 px-2 py-1">
                  {[line.warehouse_name, line.location_name].filter(Boolean).join(' / ') || '—'}
                </td>
                <td className="border border-slate-300 px-2 py-1 text-right tabular-nums">{line.quantity}</td>
                <td className="border border-slate-300 px-2 py-1">{line.destination_name ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
