'use client';

import { useState, useActionState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import type { ReceiptWithLines, ReceiptLine } from '@/lib/db';
import LotTag from './LotTag';
import { useT } from './LanguageProvider';
import { formatQty } from '@/lib/units';
import type { UnitConfig } from '@/lib/units';
import { unreceiveIncoming } from '@/lib/actions';
import { formatDisplayDate } from '@/lib/tz';
import { useActionFeedback } from '@/hooks/useActionFeedback';

function LineItem({ line, today, unitConfig }: { line: ReceiptLine; today: string; unitConfig: UnitConfig }) {
  const { t, lang } = useT();
  const [confirming, setConfirming] = useState(false);
  const [state, action] = useActionState(unreceiveIncoming, null);
  const { errorMsg } = useActionFeedback(state, '');

  const qty = line.received_qty ?? line.expected_qty;

  return (
    <div className="py-2.5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="text-sm font-medium text-slate-800">{line.product_name}</span>
            {unitConfig.pieces_per_ball ? (
              <span className="text-xs text-slate-500">{formatQty(qty, unitConfig, lang)} ({qty}{t('units.pieceSuffix')})</span>
            ) : (
              <span className="text-xs text-slate-500">{qty} {t('incoming.units')}</span>
            )}
          </div>
          {line.lot_number && (
            <div className="mt-0.5">
              <LotTag
                lotNumber={line.lot_number}
                expiryDate={line.expiry_date}
                today={today}
                expiryLabel={t('inventory.lotExpiry')}
              />
            </div>
          )}
          {line.location_name && (
            <div className="mt-0.5">
              <span className="text-xs text-slate-400">{t('incoming.location')}: {line.location_name}</span>
            </div>
          )}
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
              <input type="hidden" name="id" value={line.id} />
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
            <span className="text-xs text-green-600 font-medium">{t('incoming.receivedLabel')}</span>
          </div>
        )}
      </div>
    </div>
  );
}

function ReceiptCard({
  receipt,
  unitMap,
  today,
  defaultOpen,
}: {
  receipt: ReceiptWithLines;
  unitMap: Record<number, UnitConfig>;
  today: string;
  defaultOpen: boolean;
}) {
  const { t, tf } = useT();
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const totalQty = receipt.receipt_lines.reduce((s, l) => s + (l.received_qty ?? l.expected_qty), 0);

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
          <span className="font-mono text-xs font-semibold bg-green-50 text-green-700 px-2 py-0.5 rounded">
            {receipt.receipt_no}
          </span>
          {receipt.supplier_name && (
            <span className="text-xs text-slate-600">{receipt.supplier_name}</span>
          )}
          {receipt.received_at && (
            <span className="text-xs text-slate-400">{formatDisplayDate(receipt.received_at.slice(0, 10))}</span>
          )}
        </div>
        <div className="text-xs text-slate-400 flex items-center gap-1.5 flex-shrink-0">
          <span>{tf<string>('common.itemCount', receipt.receipt_lines.length)}</span>
          <span>·</span>
          <span>{tf<string>('common.totalUnits', totalQty)}</span>
        </div>
      </button>
      {isOpen && (
        <div className="px-4 pb-2 divide-y divide-slate-100">
          {receipt.receipt_lines.map((line) => (
            <LineItem
              key={line.id}
              line={line}
              today={today}
              unitConfig={unitMap[line.product_id] ?? { pieces_per_ball: null, balls_per_case: null, cases_per_pallet: null }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function ReceivedHistoryList({
  receipts,
  emptyText,
  unitMap = {},
}: {
  receipts: ReceiptWithLines[];
  emptyText: string;
  unitMap?: Record<number, UnitConfig>;
}) {
  const { localDate } = useT();
  const [today] = useState(() => localDate());

  const [threshold] = useState(() => {
    const now = new Date();
    return new Date(now.getTime() - 10 * 60 * 1000).toISOString();
  });

  // Sort receipts by received_at desc
  const sorted = [...receipts].sort((a, b) => {
    const aDate = a.received_at ?? '';
    const bDate = b.received_at ?? '';
    return bDate.localeCompare(aDate);
  });

  if (receipts.length === 0) return <p className="text-slate-400 text-sm">{emptyText}</p>;

  return (
    <div className="space-y-2">
      {sorted.map((receipt) => {
        const recentlyConfirmed = receipt.receipt_lines.some(
          (l) => l.status === 'received' && receipt.received_at && receipt.received_at > threshold
        );
        const isDefaultOpen = recentlyConfirmed || sorted.indexOf(receipt) < 2;
        return (
          <ReceiptCard
            key={receipt.id}
            receipt={receipt}
            unitMap={unitMap}
            today={today}
            defaultOpen={isDefaultOpen}
          />
        );
      })}
    </div>
  );
}
