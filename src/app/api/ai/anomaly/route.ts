import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@/lib/supabase';
import { checkAdmin } from '@/lib/auth-guard';

type ShipmentRow = {
  shipped_at: string;
  shipment_lines: { product_id: number; product_name: string | null; quantity: number; shipped_qty: number | null; status: string }[];
};

export type Anomaly = {
  productId: number;
  productName: string;
  type: 'increase' | 'decrease';
  baselineAvg: number;
  recentAvg: number;
  changeRate: number;
  explanation: string;
  concerns: string;
  recommendation: string;
};

export type AnomalyResult = {
  anomalies: Anomaly[];
  summary: string;
  scannedProducts: number;
};

export async function POST() {
  if (!(await checkAdmin())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const supabase = await createClient();

  // Fetch last 90 days of shipped data
  const now = new Date();
  const from90 = new Date(now); from90.setDate(from90.getDate() - 90);
  const from30 = new Date(now); from30.setDate(from30.getDate() - 30);

  const { data: shipmentsData, error } = await supabase
    .from('shipments')
    .select('shipped_at, shipment_lines!inner(product_id, product_name, quantity, shipped_qty, status)')
    .eq('status', 'shipped')
    .not('shipped_at', 'is', null)
    .gte('shipped_at', from90.toISOString());

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Aggregate daily qty per product, split into baseline (day -90 to -30) vs recent (day -30 to now)
  type ProductStats = { name: string; baselineTotal: number; recentTotal: number };
  const productMap: Record<number, ProductStats> = {};

  for (const shipment of (shipmentsData ?? []) as ShipmentRow[]) {
    const shippedAt = new Date(shipment.shipped_at);
    const isRecent = shippedAt >= from30;

    for (const line of shipment.shipment_lines) {
      if (line.status !== 'shipped') continue;
      const qty = line.shipped_qty ?? line.quantity;
      const stats = productMap[line.product_id] ?? { name: line.product_name ?? `Product ${line.product_id}`, baselineTotal: 0, recentTotal: 0 };
      if (isRecent) stats.recentTotal += qty;
      else stats.baselineTotal += qty;
      productMap[line.product_id] = stats;
    }
  }

  // Baseline is 60 days, recent is 30 days → normalize to daily avg
  type AnomalyCandidate = { productId: number; productName: string; type: 'increase' | 'decrease'; baselineAvg: number; recentAvg: number; changeRate: number };
  const anomalies: AnomalyCandidate[] = [];

  for (const [idStr, stats] of Object.entries(productMap)) {
    const baselineAvg = stats.baselineTotal / 60;
    const recentAvg = stats.recentTotal / 30;
    if (baselineAvg < 0.1) continue; // not enough baseline data
    const changeRate = Math.round(((recentAvg - baselineAvg) / baselineAvg) * 100);
    if (changeRate >= 40) {
      anomalies.push({ productId: Number(idStr), productName: stats.name, type: 'increase', baselineAvg: Math.round(baselineAvg * 10) / 10, recentAvg: Math.round(recentAvg * 10) / 10, changeRate });
    } else if (changeRate <= -40) {
      anomalies.push({ productId: Number(idStr), productName: stats.name, type: 'decrease', baselineAvg: Math.round(baselineAvg * 10) / 10, recentAvg: Math.round(recentAvg * 10) / 10, changeRate });
    }
  }

  anomalies.sort((a, b) => Math.abs(b.changeRate) - Math.abs(a.changeRate));

  if (anomalies.length === 0) {
    return NextResponse.json({
      anomalies: [],
      summary: '直近30日間に異常な需要変動は検知されませんでした。',
      scannedProducts: Object.keys(productMap).length,
    } satisfies AnomalyResult);
  }

  // Ask Claude to explain anomalies
  const anomalyText = anomalies.map((a) =>
    `- ${a.productName}: ${a.type === 'increase' ? '需要増' : '需要減'} ${a.changeRate > 0 ? '+' : ''}${a.changeRate}%（ベースライン日平均 ${a.baselineAvg} → 直近 ${a.recentAvg}）`
  ).join('\n');

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const message = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 2048,
    messages: [
      {
        role: 'user',
        content: `倉庫管理システムで以下の需要異常が検知されました。各商品について分析してください。

${anomalyText}

以下のJSON形式のみで回答してください：
{
  "results": [
    {
      "productName": "商品名（上記と完全一致）",
      "explanation": "異常の説明（1文）",
      "concerns": "このまま放置した場合の懸念点（1文）",
      "recommendation": "推奨アクション（1文）"
    }
  ],
  "summary": "全体的な状況のサマリー（2〜3文）"
}`,
      },
    ],
  });

  const raw = message.content[0].type === 'text' ? message.content[0].text : '';
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    return NextResponse.json({ error: 'Failed to parse AI response' }, { status: 500 });
  }

  const aiResult = JSON.parse(jsonMatch[0]) as {
    results: { productName: string; explanation: string; concerns: string; recommendation: string }[];
    summary: string;
  };

  const aiMap = Object.fromEntries(aiResult.results.map((r) => [r.productName, r]));

  const enriched: Anomaly[] = anomalies.map((a) => {
    const ai = aiMap[a.productName] ?? { explanation: '-', concerns: '-', recommendation: '-' };
    return { ...a, ...ai };
  });

  return NextResponse.json({
    anomalies: enriched,
    summary: aiResult.summary,
    scannedProducts: Object.keys(productMap).length,
  } satisfies AnomalyResult);
}
