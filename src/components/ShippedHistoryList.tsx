'use client';

import { useState, useActionState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import type { ShipmentWithLines, ShipmentLine } from '@/lib/db';
import LotTag from './LotTag';
import { useT } from './LanguageProvider';
import { formatQty } from '@/lib/units';
import type { UnitConfig } from '@/lib/units';
import { unshipOutgoing, returnOutgoing } from '@/lib/actions';
import { formatDisplayDate } from '@/lib/tz';
import { useActionFeedback } from '@/hooks/useActionFeedback';

type LineMode = 'none' | 'return';

function ShipmentLineRow({
  line,
  today,
  unitConfig,
}: {
  line: ShipmentLine;
  today: string;
  unitConfig: UnitConfig;
}) {
  const { t, tf, lang } = useT();
  const [mode, setMode] = useState<LineMode>('none');
  const [returnQtyStr, setReturnQtyStr] = useState('');
  const [returnState, returnAction] = useActionState(returnOutgoing, null);
  const { errorMsg: returnError } = useActionFeedback(returnState, '');

  const alreadyReturned = line.returned_qty ?? 0;
  const maxReturn = line.quantity - alreadyReturned;

  return (
    <div className="py-2.5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="text-sm font-medium text-slate-800">{line.product_name}</span>
            {unitConfig.pieces_per_ball ? (
              <span className="text-xs text-slate-500">{formatQty(line.quantity, unitConfig, lang)} ({line.quantity}{t('units.pieceSuffix')})</span>
            ) : (
              <span className="text-xs text-slate-500">{line.quantity} {t('shipping.units')}</span>
            )}
            {alreadyReturned > 0 && (
              <span className="text-xs font-medium text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-full">
                {tf<string>('shipping.returnedQty', alreadyReturned)}
              </span>
            )}
            {line.note && <span className="text-xs text-slate-400">· {line.note}</span>}
          </div>
          {line.lot_number && (
            <div className="mt-0.5">
              <LotTag lotNumber={line.lot_number} expiryDate={null} today={today} />
            </div>
          )}
          {returnError && <p className="text-red-600 text-xs mt-0.5">{returnError}</p>}
          {mode === 'return' && (
            <div className="mt-2 flex items-center gap-2 flex-wrap">
              <input
                type="number"
                min={1}
                max={maxReturn}
                value={returnQtyStr}
                onChange={(e) => setReturnQtyStr(e.target.value)}
                placeholder={String(maxReturn)}
                className="w-20 border border-slate-300 rounded-md px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
              <form action={returnAction} className="flex items-center gap-1.5">
                <input type="hidden" name="id" value={line.id} />
                <input type="hidden" name="return_qty" value={returnQtyStr || maxReturn} />
                <button type="submit"
                  className="text-xs bg-amber-100 text-amber-700 hover:bg-amber-200 px-2.5 py-1 rounded-lg font-medium transition-colors">
                  {t('shipping.returnSubmit')}
                </button>
              </form>
              <button type="button" onClick={() => setMode('none')}
                className="text-xs text-slate-400 hover:text-slate-600 px-2 py-1 rounded">
                {t('common.cancel')}
              </button>
            </div>
          )}
        </div>
        {mode !== 'return' && maxReturn > 0 && (
          <button type="button" onClick={() => { setMode('return'); setReturnQtyStr(String(maxReturn)); }}
            className="text-xs text-slate-400 hover:text-amber-600 px-2 py-1.5 rounded-lg hover:bg-amber-50 transition-colors flex-shrink-0">
            {t('shipping.return')}
          </button>
        )}
      </div>
    </div>
  );
}

function ShipmentCard({
  shipment,
  unitMap,
  today,
  defaultOpen,
}: {
  shipment: ShipmentWithLines;
  unitMap: Record<number, UnitConfig>;
  today: string;
  defaultOpen: boolean;
}) {
  const { t, tf } = useT();
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [undoMode, setUndoMode] = useState(false);
  const [undoState, undoAction] = useActionState(unshipOutgoing, null);
  const { errorMsg: undoError } = useActionFeedback(undoState, '');

  const totalQty = shipment.shipment_lines.reduce((s, l) => s + l.quantity, 0);

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50 transition-colors"
      >
        <div className="flex items-center gap-2 flex-wrap">
          {isOpen
            ? <ChevronDown size={15} className="text-slate-400" />
            : <ChevronRight size={15} className="text-slate-400" />}
          <span className="font-mono text-xs font-semibold bg-blue-50 text-blue-700 px-2 py-0.5 rounded">
            {shipment.shipment_no}
          </span>
          {shipment.destination_name && (
            <span className="text-xs text-slate-600">{shipment.destination_name}</span>
          )}
          {shipment.carrier_name && (
            <span className="text-xs text-slate-400">{t('shipping.carrier')}: {shipment.carrier_name}</span>
          )}
          {shipment.shipped_at && (
            <span className="text-xs text-slate-400">{formatDisplayDate(shipment.shipped_at.slice(0, 10))}</span>
          )}
        </div>
        <div className="text-xs text-slate-400 flex items-center gap-1.5 flex-shrink-0">
          <span>{tf<string>('common.itemCount', shipment.shipment_lines.length)}</span>
          <span>·</span>
          <span>{tf<string>('common.totalUnits', totalQty)}</span>
        </div>
      </button>
      {isOpen && (
        <div className="px-4 pb-2">
          <div className="divide-y divide-slate-100">
            {shipment.shipment_lines.map((line) => (
              <ShipmentLineRow
                key={line.id}
                line={line}
                today={today}
                unitConfig={unitMap[line.product_id] ?? { pieces_per_ball: null, balls_per_case: null, cases_per_pallet: null }}
              />
            ))}
          </div>
          {/* Undo at shipment level */}
          {undoError && <p className="text-red-600 text-xs pt-1">{undoError}</p>}
          <div className="pt-2 flex items-center gap-2">
            <span className="text-xs text-blue-600 font-medium">{t('shipping.confirmed')}</span>
            {undoMode ? (
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-slate-500">{t('common.undoQuestion')}</span>
                <button type="button" onClick={() => setUndoMode(false)}
                  className="text-xs text-slate-400 hover:text-slate-600 px-2 py-1 rounded">
                  {t('common.cancel')}
                </button>
                <form action={undoAction}>
                  <input type="hidden" name="id" value={shipment.id} />
                  <button type="submit" className="text-xs text-orange-600 hover:text-orange-700 font-medium px-2 py-1 rounded">
                    {t('common.undo')}
                  </button>
                </form>
              </div>
            ) : (
              <button type="button" onClick={() => setUndoMode(true)}
                className="text-xs text-slate-400 hover:text-orange-600 px-2 py-1.5 rounded-lg hover:bg-orange-50 transition-colors">
                {t('common.undo')}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

interface DeliveryGroup {
  date: string;
  destination: string | null;
  carrier: string | null;
  shipments: ShipmentWithLines[];
}

function buildDeliveryGroups(shipments: ShipmentWithLines[]): DeliveryGroup[] {
  const map = new Map<string, DeliveryGroup>();
  for (const s of shipments) {
    const shippedDate = s.shipped_at?.slice(0, 10) ?? s.scheduled_date;
    const key = `${shippedDate}||${s.destination_name ?? ''}||${s.carrier_name ?? ''}`;
    if (!map.has(key)) {
      map.set(key, { date: shippedDate, destination: s.destination_name, carrier: s.carrier_name, shipments: [] });
    }
    map.get(key)!.shipments.push(s);
  }
  return Array.from(map.values()).sort((a, b) => b.date.localeCompare(a.date));
}

export default function ShippedHistoryList({
  shipments,
  emptyText,
  unitMap = {},
  showDeliveryNote = true,
}: {
  shipments: ShipmentWithLines[];
  emptyText: string;
  unitMap?: Record<number, UnitConfig>;
  showDeliveryNote?: boolean;
}) {
  const { t } = useT();
  const { localDate } = useT();
  const [today] = useState(() => localDate());

  const [threshold] = useState(() => {
    const now = new Date();
    return new Date(now.getTime() - 10 * 60 * 1000).toISOString();
  });

  // Sort shipments by shipped_at desc
  const sorted = [...shipments].sort((a, b) => {
    const aDate = a.shipped_at ?? '';
    const bDate = b.shipped_at ?? '';
    return bDate.localeCompare(aDate);
  });

  const deliveryGroups = buildDeliveryGroups(shipments);

  if (shipments.length === 0) return <p className="text-slate-400 text-sm">{emptyText}</p>;

  return (
    <div>
      {showDeliveryNote && (
        <div className="flex justify-end mb-2 print:hidden">
          <button type="button" onClick={() => window.print()}
            className="px-3 py-1.5 text-sm border border-slate-300 rounded-lg text-slate-600 hover:bg-slate-50 transition-colors">
            {t('shipping.printDeliveryNote')}
          </button>
        </div>
      )}

      {/* Regular shipped list — hidden when printing */}
      <div className="print:hidden space-y-2">
        {sorted.map((shipment) => {
          const recentlyConfirmed = shipment.shipped_at && shipment.shipped_at > threshold;
          const isDefaultOpen = recentlyConfirmed || sorted.indexOf(shipment) < 2;
          return (
            <ShipmentCard
              key={shipment.id}
              shipment={shipment}
              unitMap={unitMap}
              today={today}
              defaultOpen={!!isDefaultOpen}
            />
          );
        })}
      </div>

      {/* Delivery note — print only, history page only */}
      <div className={showDeliveryNote ? 'hidden print:block text-sm' : 'hidden'}>
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
                {group.shipments.flatMap((s) =>
                  s.shipment_lines.map((line, ii) => (
                    <tr key={`${s.id}-${ii}`} className="border-b border-slate-200">
                      <td className="border border-slate-300 px-2 py-1">{line.product_name}</td>
                      <td className="border border-slate-300 px-2 py-1 font-mono">{line.lot_number ?? '—'}</td>
                      <td className="border border-slate-300 px-2 py-1 text-right">{line.quantity}</td>
                    </tr>
                  ))
                )}
              </tbody>
              <tfoot>
                <tr className="bg-slate-50">
                  <td className="border border-slate-300 px-2 py-1 font-semibold" colSpan={2}></td>
                  <td className="border border-slate-300 px-2 py-1 text-right font-bold">
                    {group.shipments.reduce((s, sh) => s + sh.shipment_lines.reduce((ls, l) => ls + l.quantity, 0), 0)}
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
