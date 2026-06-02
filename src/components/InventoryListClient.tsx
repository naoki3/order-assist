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
  const { t, lang } = useT();
  const [query, setQuery] = useState('');

  const filtered = query.trim()
    ? products.filter((p) => p.name.toLowerCase().includes(query.toLowerCase()))
    : products;

  return (
    <div>
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
            return (
              <Link
                key={p.id}
                href={`/inventory/${p.id}`}
                className="flex items-center justify-between px-4 py-3 hover:bg-slate-50 transition-colors"
              >
                <p className="text-sm font-medium text-slate-800 truncate flex-1 min-w-0">{p.name}</p>
                <div className="flex items-center gap-3 ml-4 shrink-0">
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
