import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@/lib/supabase';
import { checkAdmin } from '@/lib/auth-guard';

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

const TOOLS: Anthropic.Tool[] = [
  {
    name: 'search_inventory',
    description: '在庫一覧を取得します。商品名で絞り込みや、一定数量以下の商品を検索できます。',
    input_schema: {
      type: 'object' as const,
      properties: {
        product_name: { type: 'string', description: '商品名（部分一致）' },
        max_stock: { type: 'number', description: 'この数量以下の在庫を検索' },
        limit: { type: 'number', description: '取得件数（デフォルト20）' },
      },
    },
  },
  {
    name: 'search_expiring_lots',
    description: '賞味期限切れ間近のロットを検索します。',
    input_schema: {
      type: 'object' as const,
      properties: {
        within_days: { type: 'number', description: '何日以内に期限切れになるロットを検索するか' },
        product_name: { type: 'string', description: '商品名（部分一致）' },
      },
      required: ['within_days'],
    },
  },
  {
    name: 'search_shipments',
    description: '出荷予定・出荷履歴を検索します。',
    input_schema: {
      type: 'object' as const,
      properties: {
        status: { type: 'string', description: 'ステータス: requested/allocated/shortage/shipped' },
        within_days: { type: 'number', description: '今後N日以内の予定を検索' },
        product_name: { type: 'string', description: '商品名で絞り込み' },
        limit: { type: 'number', description: '取得件数（デフォルト20）' },
      },
    },
  },
  {
    name: 'search_incoming',
    description: '入荷予定を検索します。',
    input_schema: {
      type: 'object' as const,
      properties: {
        within_days: { type: 'number', description: '今後N日以内の予定を検索' },
        product_name: { type: 'string', description: '商品名で絞り込み' },
        limit: { type: 'number', description: '取得件数（デフォルト20）' },
      },
    },
  },
];

const SYSTEM = `あなたは倉庫管理システムのAIアシスタントです。
ユーザーの質問に答えるため、必要に応じてツールを使ってデータを取得してください。
回答は日本語で、簡潔かつ具体的に答えてください。
数値データは表形式（Markdown）で整理し、重要なポイントは箇条書きで強調してください。
データが見つからない場合はその旨を伝えてください。`;

type ToolInput = Record<string, unknown>;

async function runTool(name: string, input: ToolInput, supabase: SupabaseClient): Promise<string> {
  if (name === 'search_inventory') {
    let query = supabase
      .from('inventory')
      .select('product_id, current_stock, allocated_qty, products!inner(name)')
      .order('current_stock', { ascending: true })
      .limit(Number(input.limit ?? 20));

    if (input.product_name) {
      query = query.ilike('products.name', `%${input.product_name}%`);
    }
    if (input.max_stock !== undefined) {
      query = query.lte('current_stock', Number(input.max_stock));
    }

    const { data, error } = await query;
    if (error) return `エラー: ${error.message}`;
    if (!data || data.length === 0) return '該当する在庫データがありません。';

    type Row = { current_stock: number; allocated_qty: number; products: { name: string } | { name: string }[] };
    return (data as Row[]).map((r) => {
      const name = Array.isArray(r.products) ? r.products[0]?.name : r.products?.name;
      return `${name}: 在庫${r.current_stock}, 引当済み${r.allocated_qty ?? 0}`;
    }).join('\n');
  }

  if (name === 'search_expiring_lots') {
    const days = Number(input.within_days ?? 30);
    const today = new Date().toISOString().slice(0, 10);
    const limit = new Date();
    limit.setDate(limit.getDate() + days);
    const limitStr = limit.toISOString().slice(0, 10);

    let query = supabase
      .from('lots')
      .select('lot_number, product_name, quantity, expiry_date, location_name')
      .not('expiry_date', 'is', null)
      .lte('expiry_date', limitStr)
      .gt('quantity', 0)
      .order('expiry_date', { ascending: true })
      .limit(Number(input.limit ?? 30));

    if (input.product_name) {
      query = query.ilike('product_name', `%${input.product_name}%`);
    }

    const { data, error } = await query;
    if (error) return `エラー: ${error.message}`;
    if (!data || data.length === 0) return `${days}日以内に期限切れになるロットはありません。`;

    type Lot = { product_name: string; lot_number: string; quantity: number; expiry_date: string; location_name: string | null };
    return (data as Lot[]).map((l) => {
      const daysLeft = Math.ceil((new Date(l.expiry_date).getTime() - new Date(today).getTime()) / 86400000);
      return `${l.product_name} ロット${l.lot_number}: ${l.quantity}個, 期限${l.expiry_date}（残${daysLeft}日）${l.location_name ? ` @${l.location_name}` : ''}`;
    }).join('\n');
  }

  if (name === 'search_shipments') {
    const limit = Number(input.limit ?? 20);
    let query = supabase
      .from('shipments')
      .select('shipment_no, status, scheduled_date, shipped_at, destination_name, shipment_lines(product_name, quantity, status)')
      .order('scheduled_date', { ascending: true })
      .limit(limit);

    if (input.status) query = query.eq('status', String(input.status));
    if (input.within_days) {
      const future = new Date();
      future.setDate(future.getDate() + Number(input.within_days));
      query = query.lte('scheduled_date', future.toISOString().slice(0, 10));
    }

    const { data, error } = await query;
    if (error) return `エラー: ${error.message}`;
    if (!data || data.length === 0) return '該当する出荷データがありません。';

    type SLine = { product_name: string | null; quantity: number; status: string };
    type SRow = { shipment_no: string; status: string; scheduled_date: string; shipped_at: string | null; destination_name: string | null; shipment_lines: SLine[] };
    const rows = data as SRow[];

    let filtered = rows;
    if (input.product_name) {
      const pname = String(input.product_name).toLowerCase();
      filtered = rows.filter((r) => r.shipment_lines.some((l) => l.product_name?.toLowerCase().includes(pname)));
    }

    return filtered.map((r) => {
      const lines = r.shipment_lines.map((l) => `  - ${l.product_name}: ${l.quantity}個`).join('\n');
      return `${r.shipment_no} [${r.status}] ${r.scheduled_date} → ${r.destination_name ?? '-'}\n${lines}`;
    }).join('\n\n');
  }

  if (name === 'search_incoming') {
    const limit = Number(input.limit ?? 20);
    let query = supabase
      .from('receipts')
      .select('receipt_no, status, expected_date, supplier_name, receipt_lines(product_name, quantity, status)')
      .not('status', 'eq', 'cancelled')
      .order('expected_date', { ascending: true })
      .limit(limit);

    if (input.within_days) {
      const future = new Date();
      future.setDate(future.getDate() + Number(input.within_days));
      query = query.lte('expected_date', future.toISOString().slice(0, 10));
    }

    const { data, error } = await query;
    if (error) return `エラー: ${error.message}`;
    if (!data || data.length === 0) return '該当する入荷予定がありません。';

    type RLine = { product_name: string | null; quantity: number; status: string };
    type RRow = { receipt_no: string; status: string; expected_date: string; supplier_name: string | null; receipt_lines: RLine[] };
    const rows = data as RRow[];

    let filtered = rows;
    if (input.product_name) {
      const pname = String(input.product_name).toLowerCase();
      filtered = rows.filter((r) => r.receipt_lines.some((l) => l.product_name?.toLowerCase().includes(pname)));
    }

    return filtered.map((r) => {
      const lines = r.receipt_lines.map((l) => `  - ${l.product_name}: ${l.quantity}個`).join('\n');
      return `${r.receipt_no} [${r.status}] 予定日${r.expected_date} (${r.supplier_name ?? '-'})\n${lines}`;
    }).join('\n\n');
  }

  return `不明なツール: ${name}`;
}

export async function POST(request: Request) {
  if (!(await checkAdmin())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { messages } = await request.json() as {
    messages: Anthropic.MessageParam[];
  };

  const supabase = await createClient();
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  let currentMessages: Anthropic.MessageParam[] = [...messages];

  // Tool-use loop (max 4 rounds)
  for (let round = 0; round < 4; round++) {
    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2048,
      system: SYSTEM,
      tools: TOOLS,
      messages: currentMessages,
    });

    if (response.stop_reason === 'end_turn') {
      const text = response.content.find((c) => c.type === 'text')?.text ?? '';
      return NextResponse.json({ content: text });
    }

    if (response.stop_reason === 'tool_use') {
      const toolResults: Anthropic.ToolResultBlockParam[] = [];
      for (const block of response.content) {
        if (block.type !== 'tool_use') continue;
        const result = await runTool(block.name, block.input as ToolInput, supabase);
        toolResults.push({ type: 'tool_result', tool_use_id: block.id, content: result });
      }
      currentMessages = [
        ...currentMessages,
        { role: 'assistant', content: response.content },
        { role: 'user', content: toolResults },
      ];
      continue;
    }

    break;
  }

  return NextResponse.json({ content: '回答を生成できませんでした。' });
}
