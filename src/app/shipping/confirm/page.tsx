import { createClient } from '@/lib/supabase';
import { getLang } from '@/lib/lang';
import { t } from '@/lib/i18n';
import type { ShipmentWithLines, ShipmentLine, Lot } from '@/lib/db';
import type { UnitConfig } from '@/lib/units';
import ShippingConfirmClient from '@/components/ShippingConfirmClient';
import { cookies } from 'next/headers';
import { toLocalDateStr, DEFAULT_TZ } from '@/lib/tz';

export const dynamic = 'force-dynamic';

function flattenShipments(shipments: ShipmentWithLines[]) {
  return shipments.flatMap((s) =>
    s.shipment_lines.map((line: ShipmentLine) => ({
      ...line,
      shipment_no:     s.shipment_no,
      shipment_type:   s.shipment_type,
      shipment_status: s.status,
      destination_id:   s.destination_id,
      destination_name: s.destination_name,
      carrier_id:       s.carrier_id,
      carrier_name:     s.carrier_name,
      scheduled_date:   s.scheduled_date,
      shipped_at:       s.shipped_at,
    }))
  );
}

export default async function ShippingConfirmPage() {
  const [supabase, lang, cookieStore] = await Promise.all([createClient(), getLang(), cookies()]);
  const today = toLocalDateStr(cookieStore.get('tz')?.value ?? DEFAULT_TZ);
  const [{ data: pendingData }, { data: shippedData }, { data: productsData }] = await Promise.all([
    supabase.from('shipments')
      .select('*, shipment_lines(*)')
      .in('status', ['requested', 'allocated'])
      .order('scheduled_date', { ascending: true })
      .order('id'),
    supabase.from('shipments')
      .select('*, shipment_lines(*)')
      .eq('status', 'shipped')
      .order('shipped_at', { ascending: false })
      .limit(60),
    supabase.from('products').select('id, pieces_per_ball, balls_per_case, cases_per_pallet'),
  ]);

  const pending = flattenShipments((pendingData ?? []) as ShipmentWithLines[]);
  const shipped = flattenShipments((shippedData ?? []) as ShipmentWithLines[]);
  const unitMap: Record<number, UnitConfig> = Object.fromEntries(
    ((productsData ?? []) as { id: number; pieces_per_ball: number | null; balls_per_case: number | null; cases_per_pallet: number | null }[])
      .map((p) => [p.id, { pieces_per_ball: p.pieces_per_ball, balls_per_case: p.balls_per_case, cases_per_pallet: p.cases_per_pallet }])
  );

  // 未引当アイテムの引当候補ロットを取得 (FEFO順)
  const unallocatedProductIds = [...new Set(pending.filter(i => !i.allocated_at).map(i => i.product_id))];
  const lotsMap: Record<number, Lot[]> = {};
  if (unallocatedProductIds.length > 0) {
    const { data: lotsData } = await supabase
      .from('lots')
      .select('*')
      .in('product_id', unallocatedProductIds)
      .gt('quantity', 0)
      .order('expiry_date', { ascending: true, nullsFirst: false })
      .order('id', { ascending: true });
    for (const lot of (lotsData ?? []) as Lot[]) {
      if (!lotsMap[lot.product_id]) lotsMap[lot.product_id] = [];
      lotsMap[lot.product_id].push(lot);
    }
  }

  return (
    <div className="space-y-6">
      <div className="print:hidden">
        <h1 className="text-xl font-bold text-slate-800 mb-1">{t('shipping.confirmTitle', lang)}</h1>
        <p className="text-sm text-slate-500">{t('shipping.confirmSubtitle', lang)}</p>
      </div>
      <ShippingConfirmClient pending={pending} shipped={shipped} unitMap={unitMap} today={today} lotsMap={lotsMap} />
    </div>
  );
}
