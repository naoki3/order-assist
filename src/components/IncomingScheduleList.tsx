'use client';

import { useState, useTransition, useRef, useActionState } from 'react';
import { ChevronDown, ChevronRight, Plus } from 'lucide-react';
import type { IncomingStock } from '@/lib/db';
import { deleteIncomingSchedule, addIncomingItem } from '@/lib/actions';
import { useT } from './LanguageProvider';
import { useActionFeedback } from '@/hooks/useActionFeedback';

interface ProductOption { id: number; name: string }

function Item({ item, isNew }: { item: IncomingStock; isNew: boolean }) {
  const { t } = useT();
  const [confirming, setConfirming] = useState(false);
  const [state, action] = useActionState(deleteIncomingSchedule, null);
  const { errorMsg } = useActionFeedback(state, t('common.deleted'));

  return (
    <div className={`flex items-center justify-between gap-3 py-2.5 ${isNew ? 'pl-2 border-l-2 border-green-400' : ''}`}>
      <div className="flex-1 min-w-0 flex items-center gap-2 flex-wrap">
        <span className="text-sm font-medium text-slate-800">{item.product_name}</span>
        <span className="text-xs text-slate-500">{item.quantity} {t('incoming.units')}</span>
        {isNew && (
          <span className="text-xs font-semibold text-green-700 bg-green-100 px-1.5 py-0.5 rounded">NEW</span>
        )}
        {errorMsg && <p className="text-red-600 text-xs">{errorMsg}</p>}
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
              {t('incoming.delete')}
            </button>
          </form>
        </div>
      ) : (
        <button type="button" onClick={() => setConfirming(true)}
          className="text-red-400 text-xs hover:text-red-600 px-3 py-1.5 rounded-lg hover:bg-red-50 transition-colors flex-shrink-0">
          {t('incoming.delete')}
        </button>
      )}
    </div>
  );
}

function AddProductForm({
  date,
  products,
  onAdded,
  onCancel,
}: {
  date?: string;
  products: ProductOption[];
  onAdded: (id: number) => void;
  onCancel: () => void;
}) {
  const { t } = useT();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await addIncomingItem(formData);
      if ('error' in result) {
        setError(result.error);
      } else {
        onAdded(result.newId);
        formRef.current?.reset();
        if (date) onCancel();
      }
    });
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="mt-2 pt-2 border-t border-slate-100 space-y-2">
      {date
        ? <input type="hidden" name="expected_date" value={date} />
        : <input type="date" name="expected_date" required
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
      }
      <div className="flex items-center gap-2">
        <select name="product_id" required
          className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500">
          <option value="">{t('incoming.selectProduct')}</option>
          {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <input type="number" name="quantity" min={1} required
          placeholder={t('incoming.quantityPlaceholder')}
          className="w-20 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
      </div>
      {error && <p className="text-red-600 text-xs">{error}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={isPending}
          className="px-3 py-1.5 bg-green-700 text-white text-xs rounded-lg hover:bg-green-800 transition-colors font-medium disabled:opacity-50">
          {isPending ? t('incoming.adding') : t('incoming.addButton')}
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
  date,
  items,
  newIds,
  products,
  onAdded,
}: {
  date: string;
  items: IncomingStock[];
  newIds: Set<number>;
  products: ProductOption[];
  onAdded: (id: number) => void;
}) {
  const { t, tf } = useT();
  const [isOpen, setIsOpen] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
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
          <span>{tf<string>('common.itemCount', items.length)}</span>
          <span>·</span>
          <span>{tf<string>('common.totalUnits', totalQty)}</span>
        </div>
      </button>
      {isOpen && (
        <div className="px-4 pb-3">
          <div className="divide-y divide-slate-100">
            {items.map((item) => <Item key={item.id} item={item} isNew={newIds.has(item.id)} />)}
          </div>
          {showAddForm ? (
            <AddProductForm date={date} products={products} onAdded={onAdded} onCancel={() => setShowAddForm(false)} />
          ) : (
            <button type="button" onClick={() => setShowAddForm(true)}
              className="mt-2 flex items-center gap-1 text-xs text-green-700 hover:text-green-800 font-medium py-1">
              <Plus size={13} /> {t('incoming.addProduct')}
            </button>
          )}
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

interface Props {
  items: IncomingStock[];
  emptyText: string;
  products: ProductOption[];
}

export default function IncomingScheduleList({ items, emptyText, products }: Props) {
  const { t } = useT();
  const [newIds, setNewIds] = useState<Set<number>>(new Set());
  const [showNewDateForm, setShowNewDateForm] = useState(false);

  const groups = groupByDate(items);

  function handleAdded(id: number) {
    setNewIds((prev) => new Set([...prev, id]));
  }

  return (
    <div className="space-y-3">
      {showNewDateForm ? (
        <div className="bg-white rounded-xl border-2 border-dashed border-green-400 p-4">
          <p className="text-sm font-semibold text-slate-700 mb-3">{t('incoming.newDateTitle')}</p>
          <AddProductForm
            products={products}
            onAdded={(id) => { handleAdded(id); setShowNewDateForm(false); }}
            onCancel={() => setShowNewDateForm(false)}
          />
        </div>
      ) : (
        <button type="button" onClick={() => setShowNewDateForm(true)}
          className="w-full flex items-center justify-center gap-1.5 py-2.5 border-2 border-dashed border-slate-300 rounded-xl text-sm text-slate-500 hover:border-green-400 hover:text-green-700 transition-colors">
          <Plus size={15} /> {t('incoming.addDate')}
        </button>
      )}

      {groups.length === 0
        ? <p className="text-slate-400 text-sm">{emptyText}</p>
        : groups.map(({ date, items: dateItems }) => (
          <DateGroup key={date} date={date} items={dateItems} newIds={newIds} products={products} onAdded={handleAdded} />
        ))
      }
    </div>
  );
}
