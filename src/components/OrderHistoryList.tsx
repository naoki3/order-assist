'use client';

import { useState } from 'react';
import { useT } from './LanguageProvider';
import { formatDisplayDate } from '@/lib/tz';
import { formatQty } from '@/lib/units';
import type { UnitConfig } from '@/lib/units';
import type { OrderHistoryItem } from '@/lib/db';
import type { OrderItem } from '@/lib/actions';

interface Props {
  orders: OrderHistoryItem[];
  unitMap: Record<number, UnitConfig>;
  tz: string;
}

function parseItems(raw: unknown): OrderItem[] {
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export default function OrderHistoryList({ orders, unitMap, tz }: Props) {
  const { t, lang } = useT();
  const [printTarget, setPrintTarget] = useState<number | null>(null);

  function formatDate(iso: string): string {
    return new Intl.DateTimeFormat('ja-JP', {
      timeZone: tz,
      year: 'numeric', month: 'numeric', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    }).format(new Date(iso));
  }

  if (orders.length === 0) {
    return (
      <div className="text-center py-16 text-slate-400">
        <p>{t('history.noHistory')}</p>
      </div>
    );
  }

  const printOrder = orders.find((o) => o.id === printTarget);

  return (
    <>
      {/* Screen view */}
      <div className="space-y-3 print:hidden">
        {orders.map((order) => {
          const items = parseItems(order.items);
          const expectedDates = [...new Set(items.map((i) => i.expectedDate).filter(Boolean))];
          return (
            <div key={order.id} className="bg-white rounded-xl border border-slate-200 p-4">
              <div className="flex items-baseline justify-between mb-2">
                <p className="text-xs text-slate-400">{t('history.orderedAt')}{formatDate(order.created_at)}</p>
                <div className="flex items-center gap-3">
                  {expectedDates.length > 0 && (
                    <p className="text-xs font-medium text-slate-600">{t('history.expectedDate')}{expectedDates.join(', ')}</p>
                  )}
                  <button
                    type="button"
                    onClick={() => { setPrintTarget(order.id); setTimeout(() => window.print(), 50); }}
                    className="text-xs text-slate-400 hover:text-slate-600 border border-slate-200 hover:border-slate-300 px-2 py-0.5 rounded transition-colors"
                  >
                    {t('history.printOrder')}
                  </button>
                </div>
              </div>
              <div className="space-y-1">
                {items.length > 0 ? items.map((item, i) => {
                  const uc = item.productId != null ? (unitMap[item.productId] ?? { pieces_per_ball: null, balls_per_case: null, cases_per_pallet: null }) : { pieces_per_ball: null, balls_per_case: null, cases_per_pallet: null };
                  const qtyStr = uc.pieces_per_ball ? formatQty(item.quantity, uc, lang) : `${item.quantity} ${t('history.units')}`;
                  return (
                    <div key={item.productId ?? i} className="flex justify-between text-sm">
                      <span className="text-slate-700">{item.productName}</span>
                      <span className="font-semibold text-slate-800">{qtyStr}</span>
                    </div>
                  );
                }) : (
                  <p className="text-xs text-slate-400">{t('history.noDetails')}</p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Print view — shows only the selected order */}
      {printOrder && (() => {
        const items = parseItems(printOrder.items);
        const expectedDates = [...new Set(items.map((i) => i.expectedDate).filter(Boolean))];
        return (
          <div className="hidden print:block text-sm">
            <h1 className="text-xl font-bold text-slate-800 mb-6">{t('history.purchaseOrder')}</h1>
            <div className="border-b-2 border-slate-800 pb-2 mb-4">
              <p className="text-slate-600">{t('history.orderedAt')}{formatDate(printOrder.created_at)}</p>
              {expectedDates.length > 0 && (
                <p className="text-slate-600">{t('history.poExpected')}: {expectedDates.join(', ')}</p>
              )}
            </div>
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100">
                  <th className="border border-slate-300 px-3 py-2 text-left">{t('history.poProduct')}</th>
                  <th className="border border-slate-300 px-3 py-2 text-right">{t('history.poQty')}</th>
                  <th className="border border-slate-300 px-3 py-2 text-left">{t('history.poExpected')}</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, i) => {
                  const uc = item.productId != null ? (unitMap[item.productId] ?? { pieces_per_ball: null, balls_per_case: null, cases_per_pallet: null }) : { pieces_per_ball: null, balls_per_case: null, cases_per_pallet: null };
                  const qtyStr = uc.pieces_per_ball ? formatQty(item.quantity, uc, lang) : `${item.quantity}`;
                  return (
                    <tr key={item.productId ?? i} className="border-b border-slate-200">
                      <td className="border border-slate-300 px-3 py-2">{item.productName}</td>
                      <td className="border border-slate-300 px-3 py-2 text-right tabular-nums">{qtyStr}</td>
                      <td className="border border-slate-300 px-3 py-2">
                        {item.expectedDate ? formatDisplayDate(item.expectedDate) : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="bg-slate-50">
                  <td className="border border-slate-300 px-3 py-2 font-semibold" colSpan={2}></td>
                  <td className="border border-slate-300 px-3 py-2" />
                </tr>
              </tfoot>
            </table>
          </div>
        );
      })()}
    </>
  );
}
