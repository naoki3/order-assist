import { createClient } from '@/lib/supabase';
import { getLang, getTz } from '@/lib/lang';
import { t } from '@/lib/i18n';
import { toLocalDateStr } from '@/lib/tz';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { Product, Lot, Inventory } from '@/lib/db';
import InventoryDetailClient from '@/components/InventoryDetailClient';

export const dynamic = 'force-dynamic';

export interface LotOutgoingRecord {
  id: number;
  lot_id: number;
  shipped_at: string;
  quantity: number;
  destination_name: string | null;
  carrier_name: string | null;
  note: string | null;
}

export default async function InventoryDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const productId = Number(id);
  if (!productId) notFound();

  const [supabase, lang, tz] = await Promise.all([createClient(), getLang(), getTz()]);
  const today = toLocalDateStr(tz);

  const [{ data: productData }, { data: inventoryData }, { data: lotsData }, { data: locationsData }, { data: warehousesData }, { data: statusesData }] = await Promise.all([
    supabase.from('products').select('*').eq('id', productId).maybeSingle(),
    supabase.from('inventory').select('*').eq('product_id', productId).maybeSingle(),
    supabase.from('lots').select('*').eq('product_id', productId)
      .order('expiry_date', { ascending: true, nullsFirst: false })
      .order('received_at', { ascending: false }),
    supabase.from('locations').select('id, name, warehouse_id').order('name'),
    supabase.from('warehouses').select('id, name').order('name'),
    supabase.from('inventory_statuses').select('id, name, color').order('name'),
  ]);

  if (!productData) notFound();

  const product = productData as Product;
  const currentStock = (inventoryData as Inventory | null)?.current_stock ?? 0;
  const lots = (lotsData ?? []) as Lot[];
  const warehouses = (warehousesData ?? []) as { id: number; name: string }[];
  const statuses = (statusesData ?? []) as { id: number; name: string; color: string }[];
  const warehouseNameMap = Object.fromEntries(warehouses.map((w) => [w.id, w.name]));

  type LocationRow = { id: number; name: string; warehouse_id: number | null };
  const locations = (locationsData ?? []).map((l: LocationRow) => ({
    id: l.id,
    name: l.name,
    warehouse_id: l.warehouse_id,
    warehouse_name: l.warehouse_id ? (warehouseNameMap[l.warehouse_id] ?? null) : null,
  }));

  // Fetch outgoing history for lots that have been shipped
  const lotIds = lots.map((l) => l.id);
  const outgoingByLot: Record<number, LotOutgoingRecord[]> = {};
  if (lotIds.length > 0) {
    const { data: outgoingData } = await supabase
      .from('outgoing_stock')
      .select('id, lot_id, shipped_at, quantity, destination_name, carrier_name, note')
      .in('lot_id', lotIds)
      .not('shipped_at', 'is', null)
      .order('shipped_at', { ascending: false });
    for (const row of outgoingData ?? []) {
      if (!row.lot_id) continue;
      const arr = outgoingByLot[row.lot_id] ?? [];
      arr.push(row as LotOutgoingRecord);
      outgoingByLot[row.lot_id] = arr;
    }
  }

  return (
    <div>
      <div className="mb-4">
        <Link href="/inventory" className="text-sm text-slate-500 hover:text-slate-700 transition-colors">
          {t('common.back', lang)}
        </Link>
      </div>
      <h1 className="text-xl font-bold text-slate-800 mb-4">{product.name}</h1>
      <InventoryDetailClient
        product={product}
        lots={lots}
        currentStock={currentStock}
        locations={locations}
        warehouses={warehouses}
        statuses={statuses}
        today={today}
        outgoingByLot={outgoingByLot}
      />
    </div>
  );
}
