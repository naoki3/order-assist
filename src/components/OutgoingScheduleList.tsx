'use client';

import { useState, useTransition, useRef, useActionState } from 'react';
import { ChevronDown, ChevronRight, Plus } from 'lucide-react';
import type { OutgoingStock, Lot } from '@/lib/db';
import { deleteOutgoingSchedule, addOutgoingItem } from '@/lib/actions';
import { useT } from './LanguageProvider';
import { useActionFeedback } from '@/hooks/useActionFeedback';
import LotTag from './LotTag';
import QtyInput from './QtyInput';
import { formatQty } from '@/lib/units';
import type { UnitConfig } from '@/lib/units';
import DateInput from './DateInput';

interface ProductOption {
  id: number;
  name: string;
  pieces_per_ball: number | null;
  balls_per_case: number | null;
  cases_per_pallet: number | null;
}

function Item({ item, isNew, unitConfig }: { item: OutgoingStock; isNew: boolean; unitConfig: UnitConfig }) {
  const { t, lang } = useT();
  const [confirming, setConfirming] = useState(false);
  const [state, action] = useActionState(deleteOutgoingSchedule, null);
  const { errorMsg } = useActionFeedback(state, t('common.deleted'));

  return (
    <div className={`flex items-center justify-between gap-3 py-2.5 ${isNew ? 'pl-2 border-l-2 border-green-400' : ''}`}>
      <div className="flex-1 min-w-0 flex flex-col gap-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium text-slate-800">{item.product_name}</span>
          {unitConfig.pieces_per_ball ? (
            <span className="text-xs text-slate-500">{formatQty(item.quantity, unitConfig, lang)}</span>
          ) : (
            <span className="text-xs text-slate-500">{item.quantity} {t('shipping.units')}</span>
          )}
          {item.note && <span className="text-xs text-slate-400">· {item.note}</span>}
        </div>
        {item.lot_number && <LotTag lotNumber={item.lot_number} />}
        {(isNew || errorMsg) && (
          <div className="flex items-center gap-1.5 flex-wrap">
            {isNew && <span className="text-xs font-semibold text-green-700 bg-green-100 px-1.5 py-0.5 rounded">NEW</span>}
            {errorMsg && <p className="text-red-600 text-xs">{errorMsg}</p>}
          </div>
        )}
      </div>
      {confirming ? (
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <span className="text-xs text-slate-500">{t('common.confirmQuestion')}</span>
          <button type="button" onClick={() => setConfirming(false)}
            className="text-xs text-slate-400 hover:text-slate-600 px-2 py-1 rounded">
            {t('common.cancel')}
          </button>
          <form action={action}>
            <input type="hidden" name="id" value={item.id} />
            <button type="submit" className="text-xs text-red-600 hover:text-red-700 font-medium px-2 py-1 rounded">
              {t('shipping.delete')}
            </button>
          </form>
        </div>
      ) : (
        <button type="button" onClick={() => setConfirming(true)}
          className="text-red-400 text-xs hover:text-red-600 px-3 py-1.5 rounded-lg hover:bg-red-50 transition-colors flex-shrink-0">
          {t('shipping.delete')}
        </button>
      )}
    </div>
  );
}

function AddProductForm({
  date,
  products,
  lots,
  onAdded,
  onCancel,
}: {
  date: string;
  products: ProductOption[];
  lots: Lot[];
  onAdded: (id: number) => void;
  onCancel: () => void;
}) {
  const { t } = useT();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [selectedProductId, setSelectedProductId] = useState('');
  const [selectedLotId, setSelectedLotId] = useState('');
  const formRef = useRef<HTMLFormElement>(null);

  const selectedProduct = products.find((p) => p.id === Number(selectedProductId)) ?? null;
  const unitConfig: UnitConfig = selectedProduct ?? { pieces_per_ball: null, balls_per_case: null, cases_per_pallet: null };

  const productLots = lots
    .filter(l => l.product_id === Number(selectedProductId) && l.quantity > 0)
    .sort((a, b) => {
      if (!a.expiry_date && !b.expiry_date) return 0;
      if (!a.expiry_date) return 1;
      if (!b.expiry_date) return -1;
      return a.expiry_date.localeCompare(b.expiry_date);
    });

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await addOutgoingItem(formData);
      if ('error' in result) {
        setError(result.error);
      } else {
        onAdded(result.newId);
        formRef.current?.reset();
        setSelectedProductId('');
        setSelectedLotId('');
        onCancel();
      }
    });
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="mt-2 pt-2 border-t border-slate-100 space-y-2">
      <input type="hidden" name="scheduled_date" value={date} />
      <div className="flex gap-2">
        <select name="product_id" required
          value={selectedProductId}
          onChange={(e) => { setSelectedProductId(e.target.value); setSelectedLotId(''); }}
          className="flex-1 min-w-0 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500">
          <option value="">{t('shipping.selectProduct')}</option>
          {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <QtyInput
          name="quantity"
          unitConfig={unitConfig}
          min={1}
          placeholder={t('shipping.quantityPlaceholder')}
          inputClassName="w-20 shrink-0 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
        />
      </div>
      {selectedProductId && (
        <>
          <select name="lot_id"
            value={selectedLotId}
            onChange={(e) => setSelectedLotId(e.target.value)}
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500">
            <option value="">{t('shipping.selectLot')}</option>
            {productLots.map((l) => (
              <option key={l.id} value={l.id}>
                {l.lot_number}
                {l.expiry_date ? ` · ${t('inventory.lotExpiry')} ${l.expiry_date}` : ''}
                {` · ${l.quantity}${t('shipping.units')}`}
              </option>
            ))}
          </select>
          {selectedLotId && (
            <input type="hidden" name="lot_number"
              value={productLots.find(l => l.id === Number(selectedLotId))?.lot_number ?? ''} />
          )}
        </>
      )}
      <input type="text" name="note"
        placeholder={t('shipping.notePlaceholder')}
        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
      {error && <p className="text-red-600 text-xs">{error}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={isPending}
          className="px-3 py-1.5 bg-green-700 text-white text-xs rounded-lg hover:bg-green-800 transition-colors font-medium disabled:opacity-50">
          {isPending ? t('shipping.adding') : t('shipping.addButton')}
        </button>
        <button type="button" onClick={onCancel}
          className="px-3 py-1.5 text-slate-500 text-xs rounded-lg hover:bg-slate-100 transition-colors">
          {t('common.cancel')}
        </button>
      </div>
    </form>
  );
}

function DateGroup({
  date, items, newIds, products, lots, unitMap, onAdded, defaultOpen = true,
}: {
  date: string;
  items: OutgoingStock[];
  newIds: Set<number>;
  products: ProductOption[];
  lots: Lot[];
  unitMap: Record<number, UnitConfig>;
  onAdded: (id: number) => void;
  defaultOpen?: boolean;
}) {
  const { t, tf } = useT();
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [showAddForm, setShowAddForm] = useState(items.length === 0);
  const totalQty = items.reduce((s, i) => s + i.quantity, 0);

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <button type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50 transition-colors">
        <div className="flex items-center gap-2">
          {isOpen ? <ChevronDown size={15} className="text-slate-400" /> : <ChevronRight size={15} className="text-slate-400" />}
          <span className="font-semibold text-slate-800">{date}</span>
        </div>
        <div className="text-xs text-slate-400 flex items-center gap-1.5">
          {items.length > 0 && <>
            <span>{tf<string>('common.itemCount', items.length)}</span>
            <span>·</span>
            <span>{tf<string>('common.totalUnits', totalQty)}</span>
          </>}
        </div>
      </button>
      {isOpen && (
        <div className="px-4 pb-3">
          {items.length > 0 && (
            <div className="divide-y divide-slate-100">
              {items.map((item) => <Item key={item.id} item={item} isNew={newIds.has(item.id)} unitConfig={unitMap[item.product_id] ?? { pieces_per_ball: null, balls_per_case: null, cases_per_pallet: null }} />)}
            </div>
          )}
          {showAddForm ? (
            <AddProductForm
              date={date}
              products={products}
              lots={lots}
              onAdded={onAdded}
              onCancel={() => { if (items.length > 0) setShowAddForm(false); }}
            />
          ) : (
            <button type="button" onClick={() => setShowAddForm(true)}
              className="mt-2 flex items-center gap-1 text-xs text-green-700 hover:text-green-800 font-medium py-1">
              <Plus size={13} /> {t('shipping.addProduct')}
            </button>
          )}
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

interface Props {
  items: OutgoingStock[];
  emptyText: string;
  products: ProductOption[];
  lots: Lot[];
}

export default function OutgoingScheduleList({ items, emptyText, products, lots }: Props) {
  const { t } = useT();
  const [newIds, setNewIds] = useState<Set<number>>(new Set());
  const unitMap: Record<number, UnitConfig> = Object.fromEntries(
    products.map((p) => [p.id, { pieces_per_ball: p.pieces_per_ball, balls_per_case: p.balls_per_case, cases_per_pallet: p.cases_per_pallet }])
  );
  const [pendingDate, setPendingDate] = useState<string | null>(null);
  const [showDateInput, setShowDateInput] = useState(false);
  const [dateInputValue, setDateInputValue] = useState('');

  const groups = groupByDate(items);
  const pendingDateInGroups = pendingDate ? groups.some(g => g.date === pendingDate) : false;

  function handleAdded(id: number) { setNewIds((prev) => new Set([...prev, id])); }

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
          <p className="text-sm font-semibold text-slate-700 mb-3">{t('shipping.newDateTitle')}</p>
          <div className="flex gap-2">
            <DateInput value={dateInputValue} onChange={setDateInputValue} required className="flex-1 min-w-0 text-sm" />
            <button type="submit" disabled={!dateInputValue}
              className="px-3 py-2 bg-green-700 text-white text-sm rounded-lg hover:bg-green-800 transition-colors font-medium disabled:opacity-50 shrink-0">
              {t('shipping.addButton')}
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
          <Plus size={15} /> {t('shipping.addDate')}
        </button>
      )}

      {pendingDate && !pendingDateInGroups && (
        <DateGroup key={`pending-${pendingDate}`} date={pendingDate} items={[]} newIds={newIds}
          products={products} lots={lots} unitMap={unitMap} onAdded={(id) => { handleAdded(id); setPendingDate(null); }} defaultOpen={true} />
      )}

      {groups.length === 0 && !pendingDate
        ? <p className="text-slate-400 text-sm">{emptyText}</p>
        : groups.map(({ date, items: dateItems }) => (
          <DateGroup key={date} date={date} items={dateItems} newIds={newIds}
            products={products} lots={lots} unitMap={unitMap} onAdded={handleAdded} />
        ))
      }
    </div>
  );
}
