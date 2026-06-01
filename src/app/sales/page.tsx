import { createClient } from '@/lib/supabase';
import { getLang, getTz, getCurrency, CURRENCY_SYMBOLS } from '@/lib/lang';
import { toLocalDateStr } from '@/lib/tz';
import { t } from '@/lib/i18n';
import Link from 'next/link';
import type { Product } from '@/lib/db';
import { formatQty } from '@/lib/units';

export const dynamic = 'force-dynamic';

export default async function SalesPage() {
  const [supabase, lang, tz, currency] = await Promise.all([createClient(), getLang(), getTz(), getCurrency()]);
  const currencySymbol = CURRENCY_SYMBOLS[currency];
  const todayStr = toLocalDateStr(tz);
  const start = new Date(todayStr + 'T00:00:00');
  start.setDate(start.getDate() - 30);
  const startStr = start.toISOString().split('T')[0];

  const [{ data: outgoingData }, { data: productsData }] = await Promise.all([
    supabase
      .from('shipments')
      .select('shipped_at, shipment_lines!inner(product_id, product_name, quantity, shipped_qty, unit_price, status)')
      .eq('status', 'shipped')
      .not('shipped_at', 'is', null)
      .gte('shipped_at', startStr + 'T00:00:00')
      .order('shipped_at', { ascending: false }),
    supabase.from('products').select('*').order('id'),
  ]);

  type RawShipment = { shipped_at: string; shipment_lines: { product_id: number; product_name: string; quantity: number; shipped_qty: number; unit_price: number | null; status: string }[] };
  type FlatLine = { product_id: number; product_name: string; quantity: number; shipped_at: string | null; unit_price: number | null };
  const outgoing = ((outgoingData ?? []) as RawShipment[]).flatMap((s): FlatLine[] =>
    s.shipment_lines
      .filter((l) => l.status === 'shipped')
      .map((l) => ({ product_id: l.product_id, product_name: l.product_name, quantity: l.shipped_qty ?? l.quantity, shipped_at: s.shipped_at, unit_price: l.unit_price }))
  );
  const products = (productsData ?? []) as Product[];
  const productMap = new Map(products.map((p) => [p.id, p]));

  // Group by date → product, summing quantities and revenue
  const byDate: Record<string, { productId: number; productName: string; totalPieces: number; snapshotRevenue: number | null; unitPrice: number | null }[]> = {};
  for (const o of outgoing) {
    if (!o.shipped_at) continue;
    const dateStr = toLocalDateStr(tz, new Date(o.shipped_at));
    if (!byDate[dateStr]) byDate[dateStr] = [];
    const existing = byDate[dateStr].find((r) => r.productId === o.product_id);
    const lineRevenue = o.unit_price != null ? o.unit_price * o.quantity : null;
    if (existing) {
      existing.totalPieces += o.quantity;
      if (lineRevenue != null) existing.snapshotRevenue = (existing.snapshotRevenue ?? 0) + lineRevenue;
      if (existing.unitPrice !== o.unit_price) existing.unitPrice = null; // 同日同商品で単価が違う場合は非表示
    } else {
      byDate[dateStr].push({ productId: o.product_id, productName: o.product_name, totalPieces: o.quantity, snapshotRevenue: lineRevenue, unitPrice: o.unit_price });
    }
  }
  const dates = Object.keys(byDate).sort((a, b) => b.localeCompare(a));

  function formatDate(dateStr: string): string {
    const d = new Date(dateStr + 'T00:00:00');
    return `${d.getMonth() + 1}/${d.getDate()}`;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-xl font-bold text-slate-800">{t('sales.title', lang)}</h1>
        <Link
          href="/sales/report"
          className="px-3 py-1.5 bg-green-50 text-green-700 font-medium rounded-lg hover:bg-green-100 transition-colors text-xs"
        >
          {t('nav.salesReport', lang)}
        </Link>
      </div>
      <p className="text-sm text-slate-500 mb-4">{t('sales.subtitle', lang)}</p>

      {dates.length === 0 ? (
        <p className="text-slate-400 text-sm">{t('sales.noData', lang)}</p>
      ) : (
        <div className="space-y-4">
          {dates.map((date) => {
            const rows = byDate[date];
            const totalRevenue = rows.reduce((sum, r) => {
              if (r.snapshotRevenue != null) return sum + r.snapshotRevenue;
              const p = productMap.get(r.productId);
              return sum + (p?.price ? p.price * r.totalPieces : 0);
            }, 0);
            return (
              <div key={date} className="bg-white rounded-xl border border-slate-200 p-4">
                <p className="font-semibold text-slate-700 mb-3">{formatDate(date)}</p>
                <div className="space-y-2">
                  {rows.map((r) => {
                    const p = productMap.get(r.productId);
                    const unitLabel = p ? formatQty(r.totalPieces, p, lang) : null;
                    const piecesSuffix = t('units.pieceSuffix', lang);
                    const piecesStr = `${r.totalPieces}${piecesSuffix}`;
                    const qtyLabel = unitLabel && unitLabel !== piecesStr
                      ? `${unitLabel} (${piecesStr})`
                      : piecesStr;
                    return (
                      <div key={r.productId} className="flex items-center justify-between text-sm">
                        <span className="text-slate-700">{r.productName}</span>
                        <div className="flex items-center gap-3">
                          <span className="text-slate-600">{qtyLabel}</span>
                          {r.unitPrice != null && (
                            <span className="text-xs text-slate-400">@{currencySymbol}{r.unitPrice.toLocaleString()}</span>
                          )}
                          {(r.snapshotRevenue != null || p?.price != null) && (
                            <span className="text-slate-500">
                              {currencySymbol}{(r.snapshotRevenue ?? (p!.price! * r.totalPieces)).toLocaleString()}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
                {totalRevenue > 0 && (
                  <div className="mt-3 pt-2 border-t border-slate-100 flex justify-end">
                    <span className="text-sm font-medium text-slate-700">
                      {t('sales.total', lang)}: {currencySymbol}{totalRevenue.toLocaleString()}
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
