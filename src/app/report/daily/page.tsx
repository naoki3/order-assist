import { createClient } from '@/lib/supabase';
import { getLang, getTz } from '@/lib/lang';
import { t } from '@/lib/i18n';
import { toLocalDateStr } from '@/lib/tz';
import DailyReportClient from '@/components/DailyReportClient';
import type { DailyReportRow, DailyLotSnapshot } from '@/components/DailyReportClient';

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Promise<{ from?: string; to?: string }>;
}

function enumerateDates(from: string, to: string): string[] {
  const dates: string[] = [];
  const d = new Date(from + 'T12:00:00Z');
  const end = new Date(to + 'T12:00:00Z');
  while (d <= end) {
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, '0');
    const day = String(d.getUTCDate()).padStart(2, '0');
    dates.push(`${y}-${m}-${day}`);
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return dates;
}

export default async function DailyReportPage({ searchParams }: PageProps) {
  const [lang, tz, params] = await Promise.all([getLang(), getTz(), searchParams]);
  const today = toLocalDateStr(tz);

  const sevenDaysAgo = (() => {
    const d = new Date(today + 'T00:00:00');
    d.setDate(d.getDate() - 6);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  })();

  const from = params.from ?? sevenDaysAgo;
  const to = params.to ?? today;

  const supabase = await createClient();

  const [{ data: incomingData }, { data: outgoingData }, { data: lotsRaw }, { data: lotOutgoingRaw }] = await Promise.all([
    supabase
      .from('incoming_stock')
      .select('product_name, quantity, received_at')
      .not('received_at', 'is', null)
      .gte('received_at', from + 'T00:00:00')
      .lte('received_at', to + 'T23:59:59'),
    supabase
      .from('outgoing_stock')
      .select('product_name, quantity, shipped_at')
      .not('shipped_at', 'is', null)
      .gte('shipped_at', from + 'T00:00:00')
      .lte('shipped_at', to + 'T23:59:59'),
    supabase
      .from('lots')
      .select('id, product_name, quantity, received_at, lot_number, expiry_date, status_name, warehouse_name, location_name')
      .lte('received_at', to),
    supabase
      .from('outgoing_stock')
      .select('lot_id, quantity, shipped_at')
      .not('shipped_at', 'is', null)
      .not('lot_id', 'is', null),
  ]);

  // Build activity rows (incoming / outgoing)
  const dataMap = new Map<string, DailyReportRow>();
  const key = (date: string, name: string) => `${date}||${name}`;

  for (const row of incomingData ?? []) {
    if (!row.received_at) continue;
    const date = toLocalDateStr(tz, new Date(row.received_at));
    const k = key(date, row.product_name);
    const existing = dataMap.get(k) ?? { date, product_name: row.product_name, incoming: 0, outgoing: 0, stock: 0 };
    dataMap.set(k, { ...existing, incoming: existing.incoming + row.quantity });
  }

  for (const row of outgoingData ?? []) {
    if (!row.shipped_at) continue;
    const date = toLocalDateStr(tz, new Date(row.shipped_at));
    const k = key(date, row.product_name);
    const existing = dataMap.get(k) ?? { date, product_name: row.product_name, incoming: 0, outgoing: 0, stock: 0 };
    dataMap.set(k, { ...existing, outgoing: existing.outgoing + row.quantity });
  }

  // Build lot outgoing map: lotId -> [{date, qty}]
  const outgoingByLot = new Map<number, { date: string; qty: number }[]>();
  for (const o of lotOutgoingRaw ?? []) {
    if (!o.lot_id || !o.shipped_at) continue;
    const date = toLocalDateStr(tz, new Date(o.shipped_at));
    const arr = outgoingByLot.get(o.lot_id) ?? [];
    arr.push({ date, qty: o.quantity });
    outgoingByLot.set(o.lot_id, arr);
  }

  // Compute lot snapshots for every date in [from, to]
  const allDates = enumerateDates(from, to);
  const lotSnapshots: DailyLotSnapshot[] = [];
  const stockByDateProduct = new Map<string, number>();

  for (const date of allDates) {
    for (const lot of lotsRaw ?? []) {
      // lot.received_at is a local date string (YYYY-MM-DD)
      if (lot.received_at > date) continue;

      // qty at end of date = current qty + outgoing that happened AFTER this date
      const outgoingAfter = (outgoingByLot.get(lot.id) ?? [])
        .filter((o) => o.date > date)
        .reduce((s, o) => s + o.qty, 0);
      const qtyAtDate = lot.quantity + outgoingAfter;
      if (qtyAtDate <= 0) continue;

      lotSnapshots.push({
        date,
        lot_number: lot.lot_number,
        product_name: lot.product_name,
        quantity: qtyAtDate,
        expiry_date: lot.expiry_date ?? null,
        status_name: lot.status_name ?? null,
        warehouse_name: lot.warehouse_name ?? null,
        location_name: lot.location_name ?? null,
      });

      const k = key(date, lot.product_name);
      stockByDateProduct.set(k, (stockByDateProduct.get(k) ?? 0) + qtyAtDate);
    }
  }

  // Merge stock into activity rows; add stock-only rows for inventory-present days
  for (const [k, stock] of stockByDateProduct.entries()) {
    const sepIdx = k.indexOf('||');
    const date = k.slice(0, sepIdx);
    const product_name = k.slice(sepIdx + 2);
    const existing = dataMap.get(k);
    if (existing) {
      dataMap.set(k, { ...existing, stock });
    } else {
      dataMap.set(k, { date, product_name, incoming: 0, outgoing: 0, stock });
    }
  }

  const rows = Array.from(dataMap.values()).sort((a, b) => {
    if (a.date !== b.date) return b.date.localeCompare(a.date);
    return a.product_name.localeCompare(b.product_name);
  });

  // Sort lot snapshots: date desc, product asc, lot_number asc
  lotSnapshots.sort((a, b) => {
    if (a.date !== b.date) return b.date.localeCompare(a.date);
    if (a.product_name !== b.product_name) return a.product_name.localeCompare(b.product_name);
    return a.lot_number.localeCompare(b.lot_number);
  });

  return (
    <div>
      <h1 className="text-xl font-bold text-slate-800 mb-4">{t('dailyReport.title', lang)}</h1>
      <DailyReportClient rows={rows} lotSnapshots={lotSnapshots} from={from} to={to} lang={lang} />
    </div>
  );
}
