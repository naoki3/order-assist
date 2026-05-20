import { createClient } from '@/lib/supabase';
import { getLang, getTz, getCurrency, CURRENCY_SYMBOLS } from '@/lib/lang';
import { toLocalDateStr } from '@/lib/tz';
import { t } from '@/lib/i18n';
import Link from 'next/link';
import type { Product, OutgoingStock } from '@/lib/db';
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
      .from('outgoing_stock')
      .select('*')
      .not('shipped_at', 'is', null)
      .gte('shipped_at', startStr + 'T00:00:00')
      .order('shipped_at', { ascending: false }),
    supabase.from('products').select('*').order('id'),
  ]);

  const outgoing = (outgoingData ?? []) as OutgoingStock[];
  const products = (productsData ?? []) as Product[];
  const productMap = new Map(products.map((p) => [p.id, p]));

  // Group by date → product, summing quantities
  const byDate: Record<string, { productId: number; productName: string; totalPieces: number }[]> = {};
  for (const o of outgoing) {
    if (!o.shipped_at) continue;
    const dateStr = toLocalDateStr(tz, new Date(o.shipped_at));
    if (!byDate[dateStr]) byDate[dateStr] = [];
    const existing = byDate[dateStr].find((r) => r.productId === o.product_id);
    if (existing) {
      existing.totalPieces += o.quantity;
    } else {
      byDate[dateStr].push({ productId: o.product_id, productName: o.product_name, totalPieces: o.quantity });
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
                          {p?.price != null && (
                            <span className="text-slate-500">
                              {currencySymbol}{(p.price * r.totalPieces).toLocaleString()}
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
