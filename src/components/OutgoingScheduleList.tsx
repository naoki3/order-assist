'use client';

import { useState, useTransition, useRef, useActionState } from 'react';
import { ChevronDown, ChevronRight, Plus } from 'lucide-react';
import type { ShipmentWithLines, ShipmentLine, Lot } from '@/lib/db';
import { deleteOutgoingSchedule, addOutgoingItem } from '@/lib/actions';
import { useT } from './LanguageProvider';
import { useActionFeedback } from '@/hooks/useActionFeedback';
import LotTag from './LotTag';
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
  default_warehouse_id: number | null;
}

interface DestinationOption {
  id: number;
  name: string;
}

interface CarrierOption {
  id: number;
  name: string;
}

interface LocationOption {
  id: number;
  name: string;
  warehouse_id: number | null;
}

function ShipmentLineItem({ line, unitConfig }: { line: ShipmentLine; unitConfig: UnitConfig }) {
  const { t, lang } = useT();

  return (
    <div className="flex items-center justify-between gap-3 py-2.5">
      <div className="flex-1 min-w-0 flex flex-col gap-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium text-slate-800">{line.product_name}</span>
          {unitConfig.pieces_per_ball ? (
            <span className="text-xs text-slate-500">{formatQty(line.quantity, unitConfig, lang)}</span>
          ) : (
            <span className="text-xs text-slate-500">{line.quantity} {t('shipping.units')}</span>
          )}
          {line.note && <span className="text-xs text-slate-400">· {line.note}</span>}
          {line.warehouse_name && <span className="text-xs text-slate-400">· {t('incoming.warehouseScheduled')}: {line.warehouse_name}</span>}
          {line.location_name && <span className="text-xs text-slate-400">· {t('inventory.location')}: {line.location_name}</span>}
        </div>
        {line.lot_number && <LotTag lotNumber={line.lot_number} />}
      </div>
    </div>
  );
}

function ShipmentCard({
  shipment,
  newShipmentIds,
  unitMap,
}: {
  shipment: ShipmentWithLines;
  newShipmentIds: Set<number>;
  unitMap: Record<number, UnitConfig>;
}) {
  const { t } = useT();
  const [confirming, setConfirming] = useState(false);
  const [delState, delAction] = useActionState(deleteOutgoingSchedule, null);
  const { errorMsg: delError } = useActionFeedback(delState, t('common.deleted'));
  const isNew = newShipmentIds.has(shipment.id);

  return (
    <div className={`bg-slate-50 rounded-lg border border-slate-200 mb-2 overflow-hidden ${isNew ? 'border-l-2 border-l-green-400' : ''}`}>
      {/* Card header */}
      <div className="flex items-center gap-2 px-3 py-2 bg-white border-b border-slate-100 justify-between">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-mono text-xs font-semibold bg-blue-50 text-blue-700 px-2 py-0.5 rounded">
            {shipment.shipment_no}
          </span>
          {shipment.destination_name && (
            <span className="text-xs text-slate-600">{shipment.destination_name}</span>
          )}
          {shipment.carrier_name && (
            <span className="text-xs text-slate-400">{t('shipping.carrier')}: {shipment.carrier_name}</span>
          )}
          {isNew && (
            <span className="text-xs font-semibold text-green-700 bg-green-100 px-1.5 py-0.5 rounded">NEW</span>
          )}
        </div>
        {/* Delete button at shipment level */}
        {confirming ? (
          <div className="flex items-center gap-1.5 flex-shrink-0">
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
          <button type="button" onClick={() => setConfirming(true)}
            className="text-red-400 text-xs hover:text-red-600 px-2 py-1.5 rounded-lg hover:bg-red-50 transition-colors flex-shrink-0">
            {t('shipping.delete')}
          </button>
        )}
      </div>
      {delError && <p className="text-red-600 text-xs px-3 pt-1">{delError}</p>}
      {/* Card body - lines */}
      <div className="px-3 divide-y divide-slate-100">
        {shipment.shipment_lines.map((line) => (
          <ShipmentLineItem
            key={line.id}
            line={line}
            unitConfig={unitMap[line.product_id] ?? { pieces_per_ball: null, balls_per_case: null, cases_per_pallet: null }}
          />
        ))}
      </div>
    </div>
  );
}

function AddProductForm({
  date, products, lots, destinations, carriers, locations, onAdded, onCancel,
}: {
  date: string;
  products: ProductOption[];
  lots: Lot[];
  destinations: DestinationOption[];
  carriers: CarrierOption[];
  locations: LocationOption[];
  onAdded: (shipmentId: number) => void;
  onCancel: () => void;
}) {
  const { t } = useT();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [selectedProductId, setSelectedProductId] = useState('');
  const [selectedLotId, setSelectedLotId] = useState('');
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<number | null>(null);
  const [filterExpiry, setFilterExpiry] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
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

  const availableExpiries = (() => {
    const seen = new Set<string>();
    const result: string[] = [];
    for (const l of productLots) {
      if (l.expiry_date && !seen.has(l.expiry_date)) {
        seen.add(l.expiry_date);
        result.push(l.expiry_date);
      }
    }
    return result.sort();
  })();

  const availableStatuses = (() => {
    const seen = new Set<string>();
    const result: string[] = [];
    for (const l of productLots) {
      if (l.status_name && !seen.has(l.status_name)) {
        seen.add(l.status_name);
        result.push(l.status_name);
      }
    }
    return result.sort();
  })();

  const filteredLots = productLots.filter(l => {
    if (filterExpiry && l.expiry_date !== filterExpiry) return false;
    if (filterStatus && l.status_name !== filterStatus) return false;
    return true;
  });

  const productWarehouses = (() => {
    const seen = new Set<number>();
    const result: { id: number; name: string }[] = [];
    for (const l of productLots) {
      if (l.warehouse_id && l.warehouse_name && !seen.has(l.warehouse_id)) {
        seen.add(l.warehouse_id);
        result.push({ id: l.warehouse_id, name: l.warehouse_name });
      }
    }
    return result;
  })();

  const filteredLocations = selectedWarehouseId
    ? locations.filter((l) => l.warehouse_id === selectedWarehouseId)
    : [];

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await addOutgoingItem(formData);
      if ('error' in result) {
        setError(result.error);
      } else {
        // addOutgoingItem returns newId which is the shipment_line.id
        // We need the shipment id — pass the line id and let the parent re-fetch
        // For now, call onAdded with the line id (we mark new shipments by line id later)
        onAdded(result.newId);
        formRef.current?.reset();
        setSelectedProductId('');
        setSelectedLotId('');
        setSelectedWarehouseId(null);
        setFilterExpiry('');
        setFilterStatus('');
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
          onChange={(e) => {
            const pid = Number(e.target.value);
            setSelectedProductId(e.target.value);
            setSelectedLotId('');
            setFilterExpiry('');
            setFilterStatus('');
            const prod = products.find((p) => p.id === pid);
            setSelectedWarehouseId(prod?.default_warehouse_id ?? null);
          }}
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
          <div className="flex gap-2">
            {availableExpiries.length > 0 && (
              <select
                value={filterExpiry}
                onChange={(e) => { setFilterExpiry(e.target.value); setSelectedLotId(''); }}
                className="flex-1 min-w-0 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500">
                <option value="">{t('shipping.filterExpiry')}</option>
                {availableExpiries.map((d) => (
                  <option key={d} value={d}>{formatDisplayDate(d)}</option>
                ))}
              </select>
            )}
            <select
              value={filterStatus}
              onChange={(e) => { setFilterStatus(e.target.value); setSelectedLotId(''); }}
              className="flex-1 min-w-0 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500">
              <option value="">{t('shipping.filterStatus')}</option>
              {availableStatuses.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          <select name="lot_id"
            value={selectedLotId}
            onChange={(e) => {
              const lotId = e.target.value;
              setSelectedLotId(lotId);
              if (lotId) {
                const lot = productLots.find(l => l.id === Number(lotId));
                if (lot) {
                  setFilterExpiry(lot.expiry_date ?? '');
                  setFilterStatus(lot.status_name ?? '');
                }
              }
            }}
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500">
            <option value="">{t('shipping.selectLot')}</option>
            {filteredLots.map((l) => (
              <option key={l.id} value={l.id}>{l.lot_number}</option>
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
      {productWarehouses.length > 0 && (
        <>
          <select
            name="warehouse_id"
            value={selectedWarehouseId ?? ''}
            onChange={(e) => setSelectedWarehouseId(e.target.value ? Number(e.target.value) : null)}
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          >
            <option value="">{t('transfer.toWarehouse')}</option>
            {productWarehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
          </select>
          {selectedWarehouseId && filteredLocations.length > 0 && (
            <select name="location_id" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500">
              <option value="">{t('shipping.selectLocation')}</option>
              {filteredLocations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          )}
        </>
      )}
      {destinations.length > 0 && (
        <select name="destination_id" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500">
          <option value="">{t('shipping.selectDestination')}</option>
          {destinations.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
      )}
      {carriers.length > 0 && (
        <select name="carrier_id" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500">
          <option value="">{t('shipping.selectCarrier')}</option>
          {carriers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      )}
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
  date, shipments, newShipmentIds, products, lots, destinations, carriers, locations, unitMap, onAdded, defaultOpen = true,
}: {
  date: string;
  shipments: ShipmentWithLines[];
  newShipmentIds: Set<number>;
  products: ProductOption[];
  lots: Lot[];
  destinations: DestinationOption[];
  carriers: CarrierOption[];
  locations: LocationOption[];
  unitMap: Record<number, UnitConfig>;
  onAdded: (id: number) => void;
  defaultOpen?: boolean;
}) {
  const { t, tf } = useT();
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [showAddForm, setShowAddForm] = useState(shipments.length === 0);
  const totalQty = shipments.reduce((s, sh) => s + sh.shipment_lines.reduce((ls, l) => ls + l.quantity, 0), 0);

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
          {shipments.length > 0 && <>
            <span>{tf<string>('common.itemCount', shipments.length)}</span>
            <span>·</span>
            <span>{tf<string>('common.totalUnits', totalQty)}</span>
          </>}
        </div>
      </button>
      {isOpen && (
        <div className="px-4 pb-3">
          {shipments.length > 0 && (
            <div className="mt-1">
              {shipments.map((shipment) => (
                <ShipmentCard
                  key={shipment.id}
                  shipment={shipment}
                  newShipmentIds={newShipmentIds}
                  unitMap={unitMap}
                />
              ))}
            </div>
          )}
          {showAddForm ? (
            <AddProductForm
              date={date}
              products={products}
              lots={lots}
              destinations={destinations}
              carriers={carriers}
              locations={locations}
              onAdded={onAdded}
              onCancel={() => { if (shipments.length > 0) setShowAddForm(false); }}
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

function groupByDate(shipments: ShipmentWithLines[]) {
  const map = new Map<string, ShipmentWithLines[]>();
  for (const s of shipments) {
    const arr = map.get(s.scheduled_date) ?? [];
    arr.push(s);
    map.set(s.scheduled_date, arr);
  }
  return Array.from(map.entries()).map(([date, ss]) => ({ date, shipments: ss }));
}

interface Props {
  shipments: ShipmentWithLines[];
  emptyText: string;
  products: ProductOption[];
  lots: Lot[];
  destinations?: DestinationOption[];
  carriers?: CarrierOption[];
  locations?: LocationOption[];
  today?: string;
}

export default function OutgoingScheduleList({ shipments, emptyText, products, lots, destinations = [], carriers = [], locations = [], today = '' }: Props) {
  const { t } = useT();
  // newShipmentIds tracks line.id values returned from addOutgoingItem
  // Since we can't easily get the shipment id, we track the new line id instead
  // and highlight by checking if any line in the shipment is new
  const [newLineIds, setNewLineIds] = useState<Set<number>>(new Set());
  const unitMap: Record<number, UnitConfig> = Object.fromEntries(
    products.map((p) => [p.id, { pieces_per_ball: p.pieces_per_ball, balls_per_case: p.balls_per_case, cases_per_pallet: p.cases_per_pallet }])
  );
  const [pendingDate, setPendingDate] = useState<string | null>(null);
  const [showDateInput, setShowDateInput] = useState(false);
  const [dateInputValue, setDateInputValue] = useState('');

  const groups = groupByDate(shipments);
  const pendingDateInGroups = pendingDate ? groups.some(g => g.date === pendingDate) : false;

  // Build a set of shipment IDs where any line is newly added
  // Since addOutgoingItem returns line.id, and new shipments appear after revalidation,
  // we track newly-added line ids and mark any shipment containing them
  const newShipmentIds = new Set<number>(
    shipments
      .filter(s => s.shipment_lines.some(l => newLineIds.has(l.id)))
      .map(s => s.id)
  );

  function handleAdded(id: number) { setNewLineIds((prev) => new Set([...prev, id])); }

  function handleDateSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!dateInputValue) return;
    setPendingDate(dateInputValue);
    setShowDateInput(false);
    setDateInputValue('');
  }

  return (
    <div>
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
          <DateGroup key={`pending-${pendingDate}`} date={pendingDate} shipments={[]} newShipmentIds={newShipmentIds}
            products={products} lots={lots} destinations={destinations} carriers={carriers} unitMap={unitMap} locations={locations} onAdded={(id) => { handleAdded(id); setPendingDate(null); }} defaultOpen={true} />
        )}

        {groups.length === 0 && !pendingDate
          ? <p className="text-slate-400 text-sm">{emptyText}</p>
          : groups.map(({ date, shipments: dateShipments }) => (
            <DateGroup key={date} date={date} shipments={dateShipments} newShipmentIds={newShipmentIds}
              products={products} lots={lots} destinations={destinations} carriers={carriers} unitMap={unitMap} locations={locations} onAdded={handleAdded} defaultOpen={date === today} />
          ))
        }
      </div>
    </div>
  );
}
