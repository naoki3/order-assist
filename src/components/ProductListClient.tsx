'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Search } from 'lucide-react';
import type { Product } from '@/lib/db';
import AddProductForm from './AddProductForm';
import ProductCsvImport from './ProductCsvImport';
import { useT } from './LanguageProvider';

interface WarehouseOption {
  id: number;
  name: string;
}

interface Props {
  products: Product[];
  stockMap: Record<number, number>;
  warehouses: WarehouseOption[];
}

export default function ProductListClient({ products, stockMap, warehouses }: Props) {
  const { t } = useT();
  const [query, setQuery] = useState('');
  const [showAdd, setShowAdd] = useState(false);

  const filtered = query.trim()
    ? products.filter((p) => p.name.toLowerCase().includes(query.toLowerCase()))
    : products;

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('common.search') + '…'}
            className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
          />
        </div>
        <button
          onClick={() => setShowAdd((v) => !v)}
          className="shrink-0 px-3 py-2 bg-green-700 text-white text-sm rounded-lg hover:bg-green-800 transition-colors font-medium"
        >
          {showAdd ? t('common.cancel') : `＋ ${t('products.addTitle')}`}
        </button>
      </div>

      {showAdd && (
        <div className="mb-4">
          <AddProductForm warehouses={warehouses} onAdded={() => setShowAdd(false)} />
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100 mb-4">
        {filtered.length === 0 ? (
          <p className="text-slate-400 text-sm px-4 py-6 text-center">{t('products.noProducts')}</p>
        ) : (
          filtered.map((p) => (
            <Link
              key={p.id}
              href={`/products/${p.id}`}
              className="flex items-center justify-between px-4 py-3 hover:bg-slate-50 transition-colors"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-800 truncate">{p.name}</p>
                {p.default_warehouse_name && (
                  <p className="text-xs text-slate-400 mt-0.5">{p.default_warehouse_name}</p>
                )}
              </div>
              <div className="flex items-center gap-4 ml-4 shrink-0">
                <span className="text-sm text-slate-600">
                  {(stockMap[p.id] ?? 0).toLocaleString()} {t('products.units')}
                </span>
                <span className="text-slate-300">›</span>
              </div>
            </Link>
          ))
        )}
      </div>

      <ProductCsvImport />
    </div>
  );
}
