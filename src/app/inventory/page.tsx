import { createClient } from '@/lib/supabase';
import { getLang, getTz } from '@/lib/lang';
import { t } from '@/lib/i18n';
import { toLocalDateStr } from '@/lib/tz';
import type { Product, Inventory, Lot } from '@/lib/db';
import InventoryListClient from '@/components/InventoryListClient';
import LotTag from '@/components/LotTag';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

const COLOR_MAP: Record<string, string> = {
  slate: 'bg-slate-100 text-slate-700',
  red: 'bg-red-100 text-red-700',
  amber: 'bg-amber-100 text-amber-700',
  green: 'bg-green-100 text-green-700',
  blue: 'bg-blue-100 text-blue-700',
  purple: 'bg-purple-100 text-purple-700',
  orange: 'bg-orange-100 text-orange-700',
};

export default async function InventoryPage({
  searchParams,
}: {
  searchParams: Promise<{
    warehouse?: string;
    location?: string;
    status?: string;
    expiry_from?: string;
    expiry_to?: string;
    lot?: string;
  }>;
}) {
  const { warehouse, location, status, expiry_from, expiry_to, lot } = await searchParams;
  const hasFilter = !!(warehouse || location || status || expiry_from || expiry_to || lot);

  const [supabase, lang, tz] = await Promise.all([createClient(), getLang(), getTz()]);
  const today = toLocalDateStr(tz);

  const [{ data: warehousesData }, { data: locationsData }, { data: statusesData }] = await Promise.all([
    supabase.from('warehouses').select('id, name').order('name'),
    supabase.from('locations').select('id, name, warehouse_id').order('name'),
    supabase.from('inventory_statuses').select('id, name, color').order('name'),
  ]);

  const warehouses = (warehousesData ?? []) as { id: number; name: string }[];
  const allLocations = (locationsData ?? []) as { id: number; name: string; warehouse_id: number | null }[];
  const statuses = (statusesData ?? []) as { id: number; name: string; color: string }[];

  // Cascade: if warehouse is selected, only show its locations in the dropdown
  const locationOptions = warehouse
    ? allLocations.filter((l) => l.warehouse_id === parseInt(warehouse))
    : allLocations;

  let filteredLots: Lot[] = [];
  if (hasFilter) {
    let query = supabase
      .from('lots')
      .select('*')
      .gt('quantity', 0)
      .order('product_name', { ascending: true })
      .order('expiry_date', { ascending: true, nullsFirst: false });

    if (warehouse) query = query.eq('warehouse_id', parseInt(warehouse));
    if (location) query = query.eq('location_id', parseInt(location));
    if (status) query = query.eq('status_id', parseInt(status));
    if (expiry_from) query = query.gte('expiry_date', expiry_from);
    if (expiry_to) query = query.lte('expiry_date', expiry_to);
    if (lot) query = query.ilike('lot_number', `%${lot}%`);

    const { data } = await query;
    filteredLots = (data ?? []) as Lot[];
  }

  let products: Product[] = [];
  let stockMap: Record<number, number> = {};
  if (!hasFilter) {
    const [{ data: productsData }, { data: inventoriesData }] = await Promise.all([
      supabase.from('products').select('*').order('name').limit(1000),
      supabase.from('inventory').select('*').limit(1000),
    ]);
    const allProducts = (productsData ?? []) as Product[];
    const inventories = (inventoriesData ?? []) as Inventory[];
    stockMap = Object.fromEntries(inventories.map((i) => [i.product_id, i.current_stock]));
    products = allProducts.filter((p) => (stockMap[p.id] ?? 0) > 0);
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-slate-800">{t('inventory.title', lang)}</h1>

      <form method="GET" className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div>
            <label className="block text-xs text-slate-500 mb-1">{t('dailyReport.warehouse', lang)}</label>
            <select name="warehouse" defaultValue={warehouse ?? ''}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500">
              <option value="">すべて</option>
              {warehouses.map((w) => <option key={w.id} value={String(w.id)}>{w.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">{t('dailyReport.location', lang)}</label>
            <select name="location" defaultValue={location ?? ''}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500">
              <option value="">すべて</option>
              {locationOptions.map((l) => <option key={l.id} value={String(l.id)}>{l.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">{t('inventory.correctionStatus', lang)}</label>
            <select name="status" defaultValue={status ?? ''}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500">
              <option value="">すべて</option>
              {statuses.map((s) => <option key={s.id} value={String(s.id)}>{s.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">{t('inventory.expiryDate', lang)}（から）</label>
            <input type="date" name="expiry_from" defaultValue={expiry_from ?? ''}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">{t('inventory.expiryDate', lang)}（まで）</label>
            <input type="date" name="expiry_to" defaultValue={expiry_to ?? ''}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">{t('inventory.lotNumber', lang)}</label>
            <input type="text" name="lot" defaultValue={lot ?? ''} placeholder="部分一致"
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
          </div>
        </div>
        <div className="flex gap-2">
          <button type="submit"
            className="px-4 py-2 bg-green-700 text-white text-sm rounded-lg hover:bg-green-800 transition-colors font-medium shrink-0">
            {t('common.search', lang)}
          </button>
          {hasFilter && (
            <a href="/inventory"
              className="px-4 py-2 text-slate-500 text-sm rounded-lg hover:bg-slate-100 transition-colors shrink-0 flex items-center">
              {t('common.clearSearch', lang)}
            </a>
          )}
        </div>
      </form>

      {hasFilter ? (
        <div>
          <p className="text-xs text-slate-400 mb-2">{filteredLots.length} 件のロット</p>
          {filteredLots.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 px-4 py-10 text-center">
              <p className="text-sm text-slate-400">該当するロットがありません</p>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100">
              {filteredLots.map((l) => (
                <Link key={l.id} href={`/inventory/${l.product_id}`}
                  className="flex items-start justify-between gap-4 px-4 py-3 hover:bg-slate-50 transition-colors">
                  <div className="min-w-0 flex-1 space-y-1">
                    <p className="text-sm font-medium text-slate-800">{l.product_name}</p>
                    <LotTag lotNumber={l.lot_number} expiryDate={l.expiry_date} today={today} />
                    {(l.warehouse_name || l.location_name) && (
                      <p className="text-xs text-slate-400">
                        {[l.warehouse_name, l.location_name].filter(Boolean).join(' › ')}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1.5 shrink-0 pt-0.5">
                    {l.status_name && l.status_color && (
                      <span className={`text-xs px-2 py-0.5 rounded-full ${COLOR_MAP[l.status_color] ?? COLOR_MAP.slate}`}>
                        {l.status_name}
                      </span>
                    )}
                    <span className="text-sm text-slate-600">{l.quantity.toLocaleString()} 個</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      ) : (
        <InventoryListClient products={products} stockMap={stockMap} />
      )}
    </div>
  );
}
