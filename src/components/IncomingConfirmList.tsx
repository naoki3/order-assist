'use client';

import { useState, useActionState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import type { ReceiptWithLines, ReceiptLine } from '@/lib/db';
import { receiveIncoming, deleteIncomingSchedule, receiveBulkIncoming, resolveReceiptDiscrepancy } from '@/lib/actions';
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

export interface StatusOption {
  id: number;
  name: string;
  color: string;
}

function DiscrepancyRow({ line }: { line: ReceiptLine }) {
  const { t } = useT();
  const [resolving, setResolving] = useState(false);
  const [resolveState, resolveAction] = useActionState(resolveReceiptDiscrepancy, null);
  const { successMsg, errorMsg } = useActionFeedback(resolveState, t('incoming.discrepancyResolved'));

  const isResolved = !!line.resolution;

  return (
    <div className="py-2.5 space-y-1.5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex-1 min-w-0 flex flex-wrap items-baseline gap-2">
          <span className="text-sm font-medium text-slate-800">{line.product_name}</span>
          <span className="text-xs text-slate-500">
            {t('incoming.receivedQtyLabel')}: {line.received_qty ?? 0} / {line.expected_qty}
          </span>
          {isResolved ? (
            <span className="text-xs font-medium text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded-full">
              {line.resolution === 'written_off' ? t('incoming.writeOff') : t('incoming.reorder')}
            </span>
          ) : (
            <span className="text-xs font-medium text-orange-700 bg-orange-50 px-1.5 py-0.5 rounded-full">
              {t('incoming.discrepancyBadge')}
            </span>
          )}
        </div>
        {!isResolved && !resolving && (
          <button type="button" onClick={() => setResolving(true)}
            className="text-xs text-orange-600 hover:text-orange-700 px-2 py-1.5 rounded-lg hover:bg-orange-50 transition-colors flex-shrink-0">
            {t('incoming.resolveDiscrepancy')}
          </button>
        )}
      </div>
      {resolving && !isResolved && (
        <div className="flex flex-wrap gap-2">
          <form action={resolveAction} className="flex items-center gap-1.5">
            <input type="hidden" name="receipt_line_id" value={line.id} />
            <input type="hidden" name="resolution" value="written_off" />
            <button type="submit"
              className="text-xs bg-slate-100 text-slate-700 hover:bg-slate-200 px-2.5 py-1 rounded-lg font-medium transition-colors">
              {t('incoming.writeOff')}
            </button>
          </form>
          <form action={resolveAction} className="flex items-center gap-1.5">
            <input type="hidden" name="receipt_line_id" value={line.id} />
            <input type="hidden" name="resolution" value="reordered" />
            <button type="submit"
              className="text-xs bg-blue-50 text-blue-700 hover:bg-blue-100 px-2.5 py-1 rounded-lg font-medium transition-colors">
              {t('incoming.reorder')}
            </button>
          </form>
          <button type="button" onClick={() => setResolving(false)}
            className="text-xs text-slate-400 hover:text-slate-600 px-2 py-1 rounded">
            {t('common.cancel')}
          </button>
        </div>
      )}
      {errorMsg && <p className="text-red-600 text-xs">{errorMsg}</p>}
      {successMsg && <p className="text-green-600 text-xs">{successMsg}</p>}
    </div>
  );
}

function ReceiptLineItem({
  line,
  receipt,
  unitConfig,
  expiryType,
  locations,
  statuses,
}: {
  line: ReceiptLine;
  receipt: ReceiptWithLines;
  unitConfig: UnitConfig;
  expiryType: string | null;
  locations: LocationOption[];
  statuses: StatusOption[];
}) {
  const { t, lang } = useT();
  const [confirming, setConfirming] = useState(false);
  const [receiveState, receiveAction] = useActionState(receiveIncoming, null);
  const [delState, delAction] = useActionState(deleteIncomingSchedule, null);
  const [locationId, setLocationId] = useState('');
  const defaultStatus = statuses.find((s) => s.name === '良品') ?? statuses[0] ?? null;
  const [statusId, setStatusId] = useState(() => String(defaultStatus?.id ?? ''));

  const filteredLocations = receipt.warehouse_id
    ? locations.filter((l) => l.warehouse_id === receipt.warehouse_id)
    : [];

  const selectedLocation = locations.find((l) => l.id === Number(locationId));
  const selectedStatus = statuses.find((s) => s.id === Number(statusId)) ?? defaultStatus;

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
          <input type="hidden" name="status_id" value={selectedStatus?.id ?? ''} />
          <input type="hidden" name="status_name" value={selectedStatus?.name ?? ''} />
          <input type="hidden" name="status_color" value={selectedStatus?.color ?? ''} />
          <input type="text" name="lot_number" defaultValue={line.lot_number ?? ''}
            placeholder={t('incoming.lotPlaceholder')}
            className="flex-1 min-w-32 border border-slate-300 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-green-500" />
          <label className="flex flex-col gap-0.5">
            <span className="text-xs text-slate-500">{t('incoming.receivedQtyLabel')}</span>
            <input type="number" name="received_qty" min={1} max={line.expected_qty}
              defaultValue={line.expected_qty}
              className="w-20 border border-slate-300 rounded-lg px-2 py-1.5 text-xs text-right tabular-nums focus:outline-none focus:ring-2 focus:ring-green-500" />
          </label>
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
          {statuses.length > 0 && (
            <label className="flex-1 min-w-32 flex flex-col gap-0.5">
              <span className="text-xs text-slate-500">{t('inventory.correctionStatus')}</span>
              <select
                value={statusId}
                onChange={(e) => setStatusId(e.target.value)}
                className="border border-slate-300 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-green-500"
              >
                {statuses.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
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
  statuses,
}: {
  receipt: ReceiptWithLines;
  unitMap: Record<number, UnitConfig>;
  expiryTypeMap: Record<number, string | null>;
  locations: LocationOption[];
  statuses: StatusOption[];
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
        {receipt.receipt_lines.map((line) =>
          line.status === 'discrepancy' ? (
            <DiscrepancyRow key={line.id} line={line} />
          ) : (
            <ReceiptLineItem
              key={line.id}
              line={line}
              receipt={receipt}
              unitConfig={unitMap[line.product_id] ?? { pieces_per_ball: null, balls_per_case: null, cases_per_pallet: null }}
              expiryType={expiryTypeMap[line.product_id] ?? null}
              locations={locations}
              statuses={statuses}
            />
          )
        )}
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
  statuses,
}: {
  date: string;
  receipts: ReceiptWithLines[];
  unitMap: Record<number, UnitConfig>;
  expiryTypeMap: Record<number, string | null>;
  today: string;
  locations: LocationOption[];
  statuses: StatusOption[];
}) {
  const { tf } = useT();
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
              statuses={statuses}
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
  receipts, emptyText, unitMap = {}, expiryTypeMap = {}, today = '', locations = [], statuses = [],
}: {
  receipts: ReceiptWithLines[];
  emptyText: string;
  unitMap?: Record<number, UnitConfig>;
  expiryTypeMap?: Record<number, string | null>;
  today?: string;
  locations?: LocationOption[];
  statuses?: StatusOption[];
}) {
  const groups = groupByDate(receipts);
  if (receipts.length === 0) return <p className="text-slate-400 text-sm">{emptyText}</p>;
  return (
    <div className="space-y-2">
      {groups.map(({ date, receipts: dateReceipts }) => (
        <DateGroup key={date} date={date} receipts={dateReceipts} unitMap={unitMap} expiryTypeMap={expiryTypeMap} today={today} locations={locations} statuses={statuses} />
      ))}
    </div>
  );
}
