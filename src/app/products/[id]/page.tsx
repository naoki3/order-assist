import { createClient } from '@/lib/supabase';
import { getLang } from '@/lib/lang';
import { t } from '@/lib/i18n';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { Product } from '@/lib/db';
import ProductCard from '@/components/ProductCard';

export const dynamic = 'force-dynamic';

export default async function ProductDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const productId = Number(id);
  if (!productId) notFound();

  const [supabase, lang] = await Promise.all([createClient(), getLang()]);
  const [{ data: productData }, { data: inventoryData }, { data: warehousesData }] = await Promise.all([
    supabase.from('products').select('*').eq('id', productId).maybeSingle(),
    supabase.from('inventory').select('current_stock').eq('product_id', productId).maybeSingle(),
    supabase.from('warehouses').select('id, name').order('name'),
  ]);

  if (!productData) notFound();

  const product = productData as Product;
  const currentStock = (inventoryData?.current_stock ?? 0) as number;
  const warehouses = (warehousesData ?? []) as { id: number; name: string }[];

  return (
    <div>
      <div className="mb-4">
        <Link href="/products" className="text-sm text-slate-500 hover:text-slate-700 transition-colors">
          {t('common.back', lang)}
        </Link>
      </div>
      <h1 className="text-xl font-bold text-slate-800 mb-4">{product.name}</h1>
      <ProductCard product={product} currentStock={currentStock} warehouses={warehouses} />
    </div>
  );
}
