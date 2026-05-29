import { requireAdmin } from '@/lib/auth-guard';
import { createClient } from '@/lib/supabase';
import ForecastClient from '@/components/ForecastClient';
import type { Product } from '@/lib/db';

export const dynamic = 'force-dynamic';

export default async function ForecastPage() {
  await requireAdmin();

  const supabase = await createClient();
  const { data } = await supabase.from('products').select('id, name').order('name').limit(1000);
  const products = (data ?? []) as Pick<Product, 'id' | 'name'>[];

  return (
    <div>
      <h1 className="text-xl font-bold text-slate-800 mb-1">需要予測</h1>
      <p className="text-sm text-slate-500 mb-6">過去の出荷実績をもとにAIが将来の需要を予測します</p>
      <ForecastClient products={products} />
    </div>
  );
}
