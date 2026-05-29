import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@/lib/supabase';
import { checkAdmin } from '@/lib/auth-guard';

type ShipmentRow = {
  shipped_at: string;
  shipment_lines: { product_id: number; quantity: number; shipped_qty: number | null; status: string }[];
};

export async function POST(request: Request) {
  if (!(await checkAdmin())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { productId, productName } = await request.json() as { productId: number; productName: string };
  if (!productId || !productName) {
    return NextResponse.json({ error: 'productId and productName are required' }, { status: 400 });
  }

  const supabase = await createClient();

  // Fetch last 18 months of shipped data (root = shipments to avoid embedded filter issue)
  const from = new Date();
  from.setMonth(from.getMonth() - 18);
  const fromTs = from.toISOString();

  const { data: shipmentsData, error } = await supabase
    .from('shipments')
    .select('shipped_at, shipment_lines!inner(product_id, quantity, shipped_qty, status)')
    .eq('status', 'shipped')
    .not('shipped_at', 'is', null)
    .gte('shipped_at', fromTs);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Aggregate by month for this product
  const monthlyMap: Record<string, number> = {};
  for (const shipment of (shipmentsData ?? []) as ShipmentRow[]) {
    const month = shipment.shipped_at.slice(0, 7); // "YYYY-MM"
    for (const line of shipment.shipment_lines) {
      if (line.product_id !== productId || line.status !== 'shipped') continue;
      const qty = line.shipped_qty ?? line.quantity;
      monthlyMap[month] = (monthlyMap[month] ?? 0) + qty;
    }
  }

  const historicalMonths = Object.entries(monthlyMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-12); // last 12 months

  if (historicalMonths.length === 0) {
    return NextResponse.json({ error: 'No shipment data found for this product' }, { status: 404 });
  }

  // Build next 3 month labels
  const lastMonth = new Date(historicalMonths[historicalMonths.length - 1][0] + '-01');
  const nextMonths = [1, 2, 3].map((i) => {
    const d = new Date(lastMonth);
    d.setMonth(d.getMonth() + i);
    return d.toISOString().slice(0, 7);
  });

  const historyText = historicalMonths.map(([m, q]) => `${m}: ${q}`).join('\n');

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const message = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1024,
    messages: [
      {
        role: 'user',
        content: `あなたは倉庫管理システムのデータアナリストです。
以下は「${productName}」の月次出荷数量の実績データです：

${historyText}

このデータをもとに、次の3ヶ月（${nextMonths.join('、')}）の予測出荷数量を推定してください。

必ず以下のJSON形式のみで回答してください（他のテキストは不要）：
{
  "predictions": [
    {"month": "${nextMonths[0]}", "quantity": 数値, "confidence": "high"|"medium"|"low"},
    {"month": "${nextMonths[1]}", "quantity": 数値, "confidence": "high"|"medium"|"low"},
    {"month": "${nextMonths[2]}", "quantity": 数値, "confidence": "high"|"medium"|"low"}
  ],
  "reasoning": "予測の根拠を2〜3文で説明（日本語）"
}`,
      },
    ],
  });

  const raw = message.content[0].type === 'text' ? message.content[0].text : '';
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    return NextResponse.json({ error: 'Failed to parse AI response' }, { status: 500 });
  }

  const result = JSON.parse(jsonMatch[0]);
  return NextResponse.json({ historical: historicalMonths, predictions: result.predictions, reasoning: result.reasoning });
}
