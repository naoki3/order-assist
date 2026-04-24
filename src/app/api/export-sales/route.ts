import { createClient } from '@/lib/supabase';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const today = new Date();
  const from = new Date(today);
  from.setDate(today.getDate() - 30);
  const fromDate = from.toISOString().split('T')[0];

  const { data: products } = await supabase.from('products').select('id, name');
  const productMap = Object.fromEntries((products ?? []).map((p) => [p.id, p.name]));

  const { data: sales } = await supabase
    .from('sales')
    .select('date, product_id, quantity')
    .gte('date', fromDate)
    .order('date')
    .order('product_id');

  const rows = ['date,product_name,quantity'];
  for (const s of sales ?? []) {
    const name = productMap[s.product_id] ?? String(s.product_id);
    const escaped = name.includes(',') ? `"${name}"` : name;
    rows.push(`${s.date},${escaped},${s.quantity}`);
  }

  return new Response(rows.join('\n'), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="sales.csv"',
    },
  });
}
