'use client';

import { useState, useTransition, useRef, useActionState } from 'react';
import { ChevronDown, ChevronRight, Plus } from 'lucide-react';
import type { ReceiptWithLines, ReceiptLine } from '@/lib/db';
import { deleteIncomingSchedule, updateIncomingSchedule, createIncomingReceipt, addReceiptLine } from '@/lib/actions';
import { useT } from './LanguageProvider';
import { useActionFeedback } from '@/hooks/useActionFeedback';
import QtyInput from './QtyInput';
import { formatQty } from '@/lib/units';
import type { UnitConfig } from '@/lib/units';
import DateInput from './DateInput';
import { formatDisplayDate } from '@/lib/tz';

interface ProductOption {
  id: number;
  name: string;
  pieces_per_ball: number | null;
  balls_per_case: number | null;
  cases_per_pallet: number | null;
  expiry_type: string | null;
  default_warehouse_id: number | null;
}

interface SupplierOption {
  id: number;
  name: string;
}

interface WarehouseOption {
  id: number;
  name: string;
}

function generateReceiptNo(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `RCV-${y}${m}${d}-${rand}`;
}

function LineItem({ line, isNew, unitConfig }: { line: ReceiptLine; isNew: boolean; unitConfig: UnitConfig }) {
  const { t, lang } = useT();
  const [editing, setEditing] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [editError, setEditError] = useState<string | null>(null);

  function handleEdit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setEditError(null);
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await updateIncomingSchedule(formData);
      if (result && 'error' in result) setEditError(result.error);
      else setEditing(false);
    });
  }

  return (
    <div className={`py-2.5 space-y-1 ${isNew ? 'pl-2 border-l-2 border-green-400' : ''}`}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex-1 min-w-0 flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium text-slate-800">{line.product_name}</span>
          {unitConfig.pieces_per_ball ? (
            <span className="text-xs text-slate-500">{formatQty(line.expected_qty, unitConfig, lang)}</span>
          ) : (
            <span className="text-xs text-slate-500">{line.expected_qty} {t('incoming.units')}</span>
          )}
          {isNew && (
            <span className="text-xs font-semibold text-green-700 bg-green-100 px-1.5 py-0.5 rounded">NEW</span>
          )}
          {line.lot_number && (
            <span className="text-xs text-slate-400">#{line.lot_number}</span>
          )}
          {line.expiry_date && (
            <span className="text-xs text-slate-400">{t('incoming.expiryDate')}: {formatDisplayDate(line.expiry_date)}</span>
          )}
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <button type="button" onClick={() => { setEditing(!editing); setEditError(null); }}
            className="text-xs text-slate-500 hover:text-slate-700 px-2 py-1.5 rounded-lg hover:bg-slate-100 transition-colors">
            {t('incoming.editButton')}
          </button>
        </div>
      </div>
      {editing && (
        <form onSubmit={handleEdit} className="flex flex-wrap gap-2 pb-1">
          <input type="hidden" name="id" value={line.id} />
          <input type="text" name="lot_number" defaultValue={line.lot_number ?? ''}
            placeholder={t('incoming.lotPlaceholder')}
            className="flex-1 min-w-32 border border-slate-300 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-green-500" />
          <label className="flex-1 min-w-32 flex flex-col gap-0.5">
            <span className="text-xs text-slate-500">{t('incoming.expiryDate')}</span>
            <DateInput name="expiry_date" defaultValue={line.expiry_date ?? ''} className="w-full text-xs" />
          </label>
          {editError && <p className="text-red-600 text-xs w-full">{editError}</p>}
          <div className="flex gap-2">
            <button type="submit" disabled={isPending}
              className="px-3 py-1.5 bg-green-700 text-white text-xs rounded-lg hover:bg-green-800 transition-colors font-medium disabled:opacity-50">
              {isPending ? t('incoming.saving') : t('incoming.saveButton')}
            </button>
            <button type="button" onClick={() => { setEditing(false); setEditError(null); }}
              className="px-3 py-1.5 text-slate-500 text-xs rounded-lg hover:bg-slate-100 transition-colors">
              {t('common.cancel')}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

function AddLineForm({
  receiptId,
  products,
  onAdded,
  onCancel,
}: {
  receiptId: number;
  products: ProductOption[];
  onAdded: (id: number) => void;
  onCancel: () => void;
}) {
  const { t } = useT();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [selectedProductId, setSelectedProductId] = useState('');
  const formRef = useRef<HTMLFormElement>(null);

  const selectedProduct = products.find((p) => p.id === Number(selectedProductId)) ?? null;
  const unitConfig: UnitConfig = selectedProduct ?? { pieces_per_ball: null, balls_per_case: null, cases_per_pallet: null };
  const expiryRequired = selectedProduct != null && selectedProduct.expiry_type != null && selectedProduct.expiry_type !== 'none';

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await addReceiptLine(formData);
      if ('error' in result) {
        setError(result.error);
      } else {
        onAdded(result.newId);
        formRef.current?.reset();
        setSelectedProductId('');
        onCancel();
      }
    });
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="mt-2 pt-2 border-t border-slate-100 space-y-2">
      <input type="hidden" name="receipt_id" value={receiptId} />
      <div className="flex gap-2">
        <select name="product_id" required
          value={selectedProductId}
          onChange={(e) => setSelectedProductId(e.target.value)}
          className="flex-1 min-w-0 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500">
          <option value="">{t('incoming.selectProduct')}</option>
          {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <QtyInput
          name="quantity"
          unitConfig={unitConfig}
          min={1}
          placeholder={t('incoming.quantityPlaceholder')}
          inputClassName="w-20 shrink-0 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
        />
      </div>
      <div className="flex gap-2">
        <input type="text" name="lot_number"
          placeholder={t('incoming.lotNumberPlaceholder')}
          className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
        <label className="flex-1 flex flex-col gap-0.5">
          <span className={`text-xs ${expiryRequired ? 'text-slate-500' : 'text-slate-300'}`}>{t('incoming.expiryDate')}{expiryRequired && ' *'}</span>
          <DateInput name="expiry_date" className="w-full text-sm" disabled={!expiryRequired} required={expiryRequired} />
        </label>
      </div>
      {error && <p className="text-red-600 text-xs">{error}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={isPending}
          className="px-3 py-1.5 bg-green-700 text-white text-xs rounded-lg hover:bg-green-800 transition-colors font-medium disabled:opacity-50">
          {isPending ? t('incoming.adding') : t('incoming.addLine')}
        </button>
        <button type="button" onClick={onCancel}
          className="px-3 py-1.5 text-slate-500 text-xs rounded-lg hover:bg-slate-100 transition-colors">
          {t('common.cancel')}
        </button>
      </div>
    </form>
  );
}

function CreateReceiptForm({
  date,
  suppliers,
  warehouses,
  onCreated,
  onCancel,
}: {
  date: string;
  suppliers: SupplierOption[];
  warehouses: WarehouseOption[];
  onCreated: () => void;
  onCancel: () => void;
}) {
  const { t } = useT();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [receiptNo, setReceiptNo] = useState(() => generateReceiptNo());

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await createIncomingReceipt(formData);
      if ('error' in result) {
        setError(result.error);
      } else {
        onCreated();
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="mt-2 pt-2 border-t border-slate-100 space-y-2">
      <input type="hidden" name="expected_date" value={date} />
      <div className="flex flex-col gap-0.5">
        <span className="text-xs text-slate-500">{t('incoming.receiptNo')}</span>
        <input
          type="text"
          name="receipt_no"
          required
          value={receiptNo}
          onChange={(e) => setReceiptNo(e.target.value)}
          placeholder={t('incoming.receiptNoPlaceholder')}
          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-green-500"
        />
      </div>
      {suppliers.length > 0 && (
        <select name="supplier_id" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500">
          <option value="">{t('incoming.selectSupplier')}</option>
          {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      )}
      {warehouses.length > 0 && (
        <select name="warehouse_id" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500">
          <option value="">{t('incoming.selectWarehouse')}</option>
          {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
        </select>
      )}
      {error && <p className="text-red-600 text-xs">{error}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={isPending}
          className="px-3 py-1.5 bg-green-700 text-white text-xs rounded-lg hover:bg-green-800 transition-colors font-medium disabled:opacity-50">
          {isPending ? t('incoming.adding') : t('incoming.createReceipt')}
        </button>
        <button type="button" onClick={onCancel}
          className="px-3 py-1.5 text-slate-500 text-xs rounded-lg hover:bg-slate-100 transition-colors">
          {t('common.cancel')}
        </button>
      </div>
    </form>
  );
}

function ReceiptCard({
  receipt,
  newLineIds,
  unitMap,
  products,
  onAdded,
}: {
  receipt: ReceiptWithLines;
  newLineIds: Set<number>;
  unitMap: Record<number, UnitConfig>;
  products: ProductOption[];
  onAdded: (id: number) => void;
}) {
  const { t } = useT();
  const [confirming, setConfirming] = useState(false);
  const [showAddLine, setShowAddLine] = useState(false);
  const [delState, delAction] = useActionState(deleteIncomingSchedule, null);
  const { errorMsg: delError } = useActionFeedback(delState, t('common.deleted'));

  return (
    <div className="bg-slate-50 rounded-lg border border-slate-200 mb-2 overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 bg-white border-b border-slate-100 justify-between">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-slate-500">{t('incoming.receiptNo')}:</span>
          <span className="font-mono text-xs font-semibold bg-green-50 text-green-700 px-2 py-0.5 rounded">
            {receipt.receipt_no}
          </span>
          {receipt.supplier_name && (
            <span className="text-xs text-slate-600">{receipt.supplier_name}</span>
          )}
          {receipt.warehouse_name && (
            <span className="text-xs text-slate-400">{t('incoming.warehouseScheduled')}: {receipt.warehouse_name}</span>
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
      {delError && <p className="text-red-600 text-xs px-3 pt-1">{delError}</p>}
      <div className="px-3 divide-y divide-slate-100">
        {receipt.receipt_lines.map((line) => (
          <LineItem
            key={line.id}
            line={line}
            isNew={newLineIds.has(line.id)}
            unitConfig={unitMap[line.product_id] ?? { pieces_per_ball: null, balls_per_case: null, cases_per_pallet: null }}
          />
        ))}
      </div>
      <div className="px-3 pb-2">
        {showAddLine ? (
          <AddLineForm
            receiptId={receipt.id}
            products={products}
            onAdded={(id) => { onAdded(id); setShowAddLine(false); }}
            onCancel={() => setShowAddLine(false)}
          />
        ) : (
          <button type="button" onClick={() => setShowAddLine(true)}
            className="mt-2 flex items-center gap-1 text-xs text-green-700 hover:text-green-800 font-medium py-1">
            <Plus size={13} /> {t('incoming.addLine')}
          </button>
        )}
      </div>
    </div>
  );
}

function DateGroup({
  date,
  receipts,
  newLineIds,
  products,
  suppliers,
  warehouses,
  unitMap,
  onAdded,
  onVoucherCreated,
  defaultOpen = true,
}: {
  date: string;
  receipts: ReceiptWithLines[];
  newLineIds: Set<number>;
  products: ProductOption[];
  suppliers: SupplierOption[];
  warehouses: WarehouseOption[];
  unitMap: Record<number, UnitConfig>;
  onAdded: (id: number) => void;
  onVoucherCreated?: () => void;
  defaultOpen?: boolean;
}) {
  const { t, tf } = useT();
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [showCreateForm, setShowCreateForm] = useState(receipts.length === 0);
  const totalQty = receipts.reduce((s, r) => s + r.receipt_lines.reduce((ls, l) => ls + l.expected_qty, 0), 0);

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <button type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50 transition-colors">
        <div className="flex items-center gap-2">
          {isOpen ? <ChevronDown size={15} className="text-slate-400" /> : <ChevronRight size={15} className="text-slate-400" />}
          <span className="font-semibold text-slate-800">{formatDisplayDate(date)}</span>
        </div>
        <div className="text-xs text-slate-400 flex items-center gap-1.5">
          {receipts.length > 0 && <>
            <span>{tf<string>('common.itemCount', receipts.length)}</span>
            <span>·</span>
            <span>{tf<string>('common.totalUnits', totalQty)}</span>
          </>}
        </div>
      </button>
      {isOpen && (
        <div className="px-4 pb-3">
          {receipts.length > 0 && (
            <div className="mt-1">
              {receipts.map((receipt) => (
                <ReceiptCard
                  key={receipt.id}
                  receipt={receipt}
                  newLineIds={newLineIds}
                  unitMap={unitMap}
                  products={products}
                  onAdded={onAdded}
                />
              ))}
            </div>
          )}
          {showCreateForm ? (
            <CreateReceiptForm
              date={date}
              suppliers={suppliers}
              warehouses={warehouses}
              onCreated={() => { setShowCreateForm(false); onVoucherCreated?.(); }}
              onCancel={() => { if (receipts.length > 0) setShowCreateForm(false); }}
            />
          ) : (
            <button type="button" onClick={() => setShowCreateForm(true)}
              className="mt-2 flex items-center gap-1 text-xs text-green-700 hover:text-green-800 font-medium py-1">
              <Plus size={13} /> {t('incoming.createReceipt')}
            </button>
          )}
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
  return Array.from(map.entries()).map(([date, rs]) => ({ date, receipts: rs })).sort((a, b) => b.date.localeCompare(a.date));
}

interface Props {
  receipts: ReceiptWithLines[];
  emptyText: string;
  products: ProductOption[];
  suppliers?: SupplierOption[];
  warehouses?: WarehouseOption[];
  today?: string;
}

export default function IncomingScheduleList({ receipts, emptyText, products, suppliers = [], warehouses = [], today = '' }: Props) {
  const { t } = useT();
  const [newLineIds, setNewLineIds] = useState<Set<number>>(new Set());
  const [pendingDate, setPendingDate] = useState<string | null>(null);
  const [showDateInput, setShowDateInput] = useState(false);
  const [dateInputValue, setDateInputValue] = useState('');

  const unitMap: Record<number, UnitConfig> = Object.fromEntries(
    products.map((p) => [p.id, { pieces_per_ball: p.pieces_per_ball, balls_per_case: p.balls_per_case, cases_per_pallet: p.cases_per_pallet }])
  );

  const groups = groupByDate(receipts);
  const pendingDateInGroups = pendingDate ? groups.some(g => g.date === pendingDate) : false;

  function handleAdded(id: number) {
    setNewLineIds((prev) => new Set([...prev, id]));
  }

  function handleDateSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!dateInputValue) return;
    setPendingDate(dateInputValue);
    setShowDateInput(false);
    setDateInputValue('');
  }

  return (
    <div className="space-y-3">
      {showDateInput ? (
        <form onSubmit={handleDateSubmit} className="bg-white rounded-xl border-2 border-dashed border-green-400 p-4">
          <p className="text-sm font-semibold text-slate-700 mb-3">{t('incoming.newDateTitle')}</p>
          <div className="flex gap-2">
            <DateInput
              value={dateInputValue}
              onChange={setDateInputValue}
              required
              className="flex-1 min-w-0 text-sm"
            />
            <button type="submit" disabled={!dateInputValue}
              className="px-3 py-2 bg-green-700 text-white text-sm rounded-lg hover:bg-green-800 transition-colors font-medium disabled:opacity-50 shrink-0">
              {t('incoming.addButton')}
            </button>
            <button type="button" onClick={() => setShowDateInput(false)}
              className="px-3 py-2 text-slate-500 text-sm rounded-lg hover:bg-slate-100 transition-colors shrink-0">
              {t('common.cancel')}
            </button>
          </div>
        </form>
      ) : (
        <button type="button" onClick={() => setShowDateInput(true)}
          className="w-full flex items-center justify-center gap-1.5 py-2.5 border-2 border-dashed border-slate-300 rounded-xl text-sm text-slate-500 hover:border-green-400 hover:text-green-700 transition-colors">
          <Plus size={15} /> {t('incoming.addDate')}
        </button>
      )}

      {pendingDate && !pendingDateInGroups && (
        <DateGroup
          key={`pending-${pendingDate}`}
          date={pendingDate}
          receipts={[]}
          newLineIds={newLineIds}
          products={products}
          suppliers={suppliers}
          warehouses={warehouses}
          unitMap={unitMap}
          onAdded={handleAdded}
          onVoucherCreated={() => setPendingDate(null)}
          defaultOpen={true}
        />
      )}

      {groups.length === 0 && !pendingDate
        ? <p className="text-slate-400 text-sm">{emptyText}</p>
        : groups.map(({ date, receipts: dateReceipts }) => (
          <DateGroup key={date} date={date} receipts={dateReceipts} newLineIds={newLineIds} products={products} suppliers={suppliers} warehouses={warehouses} unitMap={unitMap} onAdded={handleAdded} defaultOpen={date === today} />
        ))
      }
    </div>
  );
}
