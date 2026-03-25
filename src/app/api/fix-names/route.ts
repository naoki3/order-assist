import { supabase } from '@/lib/supabase';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const updates = [
    { from: '牛乳 1L',         to: 'Milk 1L' },
    { from: '食パン',           to: 'Bread' },
    { from: 'たまご (10個)',    to: 'Eggs (10 pack)' },
    { from: 'ヨーグルト',       to: 'Yogurt' },
    { from: 'オレンジジュース', to: 'Orange Juice' },
  ];

  const results = [];
  for (const { from, to } of updates) {
    const { error } = await supabase.from('products').update({ name: to }).eq('name', from);
    results.push({ from, to, ok: !error, error: error?.message });
  }

  return NextResponse.json({ results });
}
