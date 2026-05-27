'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Search } from 'lucide-react';
import { useT } from './LanguageProvider';
import { formatQty } from '@/lib/units';
import type { Product } from '@/lib/db';

interface Props {
  products: Product[];
  stockMap: Record<number, number>;
}

export default function InventoryListClient({ products, stockMap }: Props) {
  const { t, lang, currencySymbol } = useT();
  const [query, setQuery] = useState('');

  const filtered = query.trim()
    ? products.filter((p) => p.name.toLowerCase().includes(query.toLowerCase()))
    : products;

  const totalValue = products.reduce((sum, p) => {
    if (p.price == null) return sum;
    return sum + (stockMap[p.id] ?? 0) * p.price;
  }, 0);
  const hasPrices = products.some((p) => p.price != null);

  return (
    <div>
      {hasPrices && (
        <div className="mb-4 bg-green-50 border border-green-200 rounded-xl px-4 py-3 flex items-center justify-between">
          <div>
            <p className="text-xs text-green-700 font-medium">{t('inventory.valuationTotal')}</p>
            <p className="text-xs text-green-500 mt-0.5">{t('inventory.valuationNoPriceHint')}</p>
          </div>
          <p className="text-xl font-bold text-green-700">{currencySymbol}{Math.round(totalValue).toLocaleString()}</p>
        </div>
      )}

      <div className="relative mb-4">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('common.search') + '…'}
          className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
        />
      </div>

      <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100">
        {filtered.length === 0 ? (
          <p className="text-slate-400 text-sm px-4 py-6 text-center">{t('inventory.noProducts')}</p>
        ) : (
          filtered.map((p) => {
            const stock = stockMap[p.id] ?? 0;
            const value = p.price != null ? stock * p.price : null;
            return (
              <Link
                key={p.id}
                href={`/inventory/${p.id}`}
                className="flex items-center justify-between px-4 py-3 hover:bg-slate-50 transition-colors"
              >
                <p className="text-sm font-medium text-slate-800 truncate flex-1 min-w-0">{p.name}</p>
                <div className="flex items-center gap-4 ml-4 shrink-0">
                  {value != null && (
                    <span className="text-xs text-slate-400 tabular-nums">
                      {currencySymbol}{Math.round(value).toLocaleString()}
                    </span>
                  )}
                  <span className="text-sm text-slate-600">
                    {p.pieces_per_ball ? formatQty(stock, p, lang) : `${stock.toLocaleString()} ${t('inventory.units')}`}
                  </span>
                  <span className="text-slate-300">›</span>
                </div>
              </Link>
            );
          })
        )}
      </div>
    </div>
  );
}
