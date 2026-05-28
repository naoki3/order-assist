'use client';

import { useState, useActionState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import type { ReceiptWithLines, ReceiptLine } from '@/lib/db';
import { receiveIncoming, deleteIncomingSchedule, receiveBulkIncoming } from '@/lib/actions';
import { useT } from './LanguageProvider';
import { useActionFeedback } from '@/hooks/useActionFeedback';
import { formatQty } from '@/lib/units';
import type { UnitConfig } from '@/lib/units';
import DateInput from './DateInput';
import { formatDisplayDate } from '@/lib/tz';

export interface LocationOption {
  id: number;
  name: string;
  warehouse_id: number | null;
}

function ReceiptLineItem({
  line,
  receipt,
  unitConfig,
  expiryType,
  locations,
}: {
  line: ReceiptLine;
  receipt: ReceiptWithLines;
  unitConfig: UnitConfig;
  expiryType: string | null;
  locations: LocationOption[];
}) {
  const { t, lang } = useT();
  const [confirming, setConfirming] = useState(false);
  const [receiveState, receiveAction] = useActionState(receiveIncoming, null);
  const [delState, delAction] = useActionState(deleteIncomingSchedule, null);
  const [locationId, setLocationId] = useState('');
  const selectedLocation = locations.find((l) => l.id === Number(locationId));

  const filteredLocations = receipt.warehouse_id
    ? locations.filter((l) => l.warehouse_id === receipt.warehouse_id)
    : [];

  const { successMsg: receiveSuccess, errorMsg: receiveError } = useActionFeedback(receiveState, t('common.received'));
  const { errorMsg: delError } = useActionFeedback(delState, t('common.deleted'));

  return (
    <div className="py-2.5 space-y-2">
      <div className="flex items-center justify-between gap-3">
        <div className="flex-1 min-w-0">
          <span className="text-sm font-medium text-slate-800">{line.product_name}</span>
          {unitConfig.pieces_per_ball ? (
            <span className="text-xs text-slate-500 ml-2">{formatQty(line.expected_qty, unitConfig, lang)}</span>
          ) : (
            <span className="text-xs text-slate-500 ml-2">{line.expected_qty} {t('incoming.units')}</span>
          )}
          {line.lot_number && (
            <span className="text-xs text-slate-400 ml-2">#{line.lot_number}</span>
          )}
          {line.expiry_date && (
            <span className="text-xs text-slate-400 ml-2">{t('incoming.expiryDate')}: {formatDisplayDate(line.expiry_date)}</span>
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
              <input type="hidden" name="id" value={receipt.id} />
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
          <input type="hidden" name="id" value={line.id} />
          <input type="hidden" name="location_id" value={locationId} />
          <input type="hidden" name="location_name" value={selectedLocation?.name ?? ''} />
          <input type="text" name="lot_number" defaultValue={line.lot_number ?? ''}
            placeholder={t('incoming.lotPlaceholder')}
            className="flex-1 min-w-32 border border-slate-300 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-green-500" />
          <label className="flex-1 min-w-32 flex flex-col gap-0.5">
            <span className={`text-xs ${expiryType && expiryType !== 'none' ? 'text-slate-500' : 'text-slate-300'}`}>{t('incoming.expiryDate')}</span>
            <DateInput name="expiry_date" defaultValue={line.expiry_date ?? ''} className="w-full text-xs" disabled={!expiryType || expiryType === 'none'} required={!!(expiryType && expiryType !== 'none')} />
          </label>
          {filteredLocations.length > 0 && (
            <label className="flex-1 min-w-32 flex flex-col gap-0.5">
              <span className="text-xs text-slate-500">{t('incoming.location')}</span>
              <select
                value={locationId}
                onChange={(e) => setLocationId(e.target.value)}
                className="border border-slate-300 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-green-500"
              >
                <option value="">—</option>
                {filteredLocations.map((l) => (
                  <option key={l.id} value={l.id}>{l.name}</option>
                ))}
              </select>
            </label>
          )}
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

function ReceiptCard({
  receipt,
  unitMap,
  expiryTypeMap,
  locations,
}: {
  receipt: ReceiptWithLines;
  unitMap: Record<number, UnitConfig>;
  expiryTypeMap: Record<number, string | null>;
  locations: LocationOption[];
}) {
  const { t, tf } = useT();
  const [bulkState, bulkAction] = useActionState(receiveBulkIncoming, null);
  const { successMsg, errorMsg } = useActionFeedback(bulkState, t('common.received'));

  return (
    <div className="bg-slate-50 rounded-lg border border-slate-200 mb-2 overflow-hidden">
      {/* Card header */}
      <div className="flex items-center gap-2 px-3 py-2 bg-white border-b border-slate-100">
        <span className="text-xs text-slate-500">{t('incoming.receiptNo')}:</span>
        <span className="font-mono text-xs font-semibold bg-green-50 text-green-700 px-2 py-0.5 rounded">
          {receipt.receipt_no}
        </span>
        {receipt.supplier_name && (
          <span className="text-xs text-slate-600">{t('incoming.supplier')}: {receipt.supplier_name}</span>
        )}
        {receipt.warehouse_name && (
          <span className="text-xs text-slate-400">{t('incoming.warehouseScheduled')}: {receipt.warehouse_name}</span>
        )}
      </div>
      {/* Card body - lines */}
      <div className="px-3 divide-y divide-slate-100">
        {receipt.receipt_lines.map((line) => (
          <ReceiptLineItem
            key={line.id}
            line={line}
            receipt={receipt}
            unitConfig={unitMap[line.product_id] ?? { pieces_per_ball: null, balls_per_case: null, cases_per_pallet: null }}
            expiryType={expiryTypeMap[line.product_id] ?? null}
            locations={locations}
          />
        ))}
      </div>
      {/* Bulk receive footer */}
      {receipt.receipt_lines.length >= 1 && (
        <div className="px-3 pb-3 pt-1">
          {errorMsg && <p className="text-red-600 text-xs pb-1">{errorMsg}</p>}
          {successMsg && <p className="text-green-600 text-xs pb-1">{successMsg}</p>}
          <form action={bulkAction}>
            <input type="hidden" name="ids" value={JSON.stringify(receipt.receipt_lines.map((l) => l.id))} />
            <button type="submit"
              className="w-full py-2 text-xs font-medium text-green-700 bg-green-50 hover:bg-green-100 rounded-lg transition-colors">
              {tf<string>('common.bulkConfirm', receipt.receipt_lines.length)}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

function DateGroup({
  date,
  receipts,
  unitMap,
  expiryTypeMap,
  today,
  locations,
}: {
  date: string;
  receipts: ReceiptWithLines[];
  unitMap: Record<number, UnitConfig>;
  expiryTypeMap: Record<number, string | null>;
  today: string;
  locations: LocationOption[];
}) {
  const { t, tf } = useT();
  const [isOpen, setIsOpen] = useState(date === today);
  const totalLines = receipts.reduce((s, r) => s + r.receipt_lines.length, 0);

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
          <span>{tf<string>('common.itemCount', receipts.length)}</span>
          <span>·</span>
          <span>{tf<string>('common.totalUnits', totalLines)}</span>
        </div>
      </button>
      {isOpen && (
        <div className="px-4 pb-3 pt-1">
          {receipts.map((receipt) => (
            <ReceiptCard
              key={receipt.id}
              receipt={receipt}
              unitMap={unitMap}
              expiryTypeMap={expiryTypeMap}
              locations={locations}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function groupByDate(receipts: ReceiptWithLines[]) {
  const map = new Map<string, ReceiptWithLines[]>();
  for (const r of receipts) {
    const arr = map.get(r.expected_date) ?? [];
    arr.push(r);
    map.set(r.expected_date, arr);
  }
  return Array.from(map.entries())
    .map(([date, rs]) => ({ date, receipts: rs }))
    .sort((a, b) => b.date.localeCompare(a.date));
}

export default function IncomingConfirmList({
  receipts, emptyText, unitMap = {}, expiryTypeMap = {}, today = '', locations = [],
}: {
  receipts: ReceiptWithLines[];
  emptyText: string;
  unitMap?: Record<number, UnitConfig>;
  expiryTypeMap?: Record<number, string | null>;
  today?: string;
  locations?: LocationOption[];
}) {
  const groups = groupByDate(receipts);
  if (receipts.length === 0) return <p className="text-slate-400 text-sm">{emptyText}</p>;
  return (
    <div className="space-y-2">
      {groups.map(({ date, receipts: dateReceipts }) => (
        <DateGroup key={date} date={date} receipts={dateReceipts} unitMap={unitMap} expiryTypeMap={expiryTypeMap} today={today} locations={locations} />
      ))}
    </div>
  );
}
