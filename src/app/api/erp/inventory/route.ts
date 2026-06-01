import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';
import { resolvePerformedBy } from '@/lib/erp-user-resolver';

interface InventoryRow {
  product_id: number;
  current_stock: number;
  allocated_qty: number | null;
  updated_at: string;
  products: { id: number; name: string; user_id: string } | null;
}

export async function GET(req: NextRequest) {
  const apiKey = req.headers.get('x-api-key');
  if (!apiKey || apiKey !== process.env.ERP_API_KEY) {
    console.error(`[ERP inventory] Unauthorized: key=${apiKey ? '(present)' : '(missing)'} ERP_API_KEY=${process.env.ERP_API_KEY ? '(set)' : '(NOT SET)'}`);
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = new URL(req.url);
  const sourceUserId = url.searchParams.get('source_user_id');
  const email = url.searchParams.get('email');
  const sourceSystem = url.searchParams.get('source_system') ?? 'ERP';

  let userId: string;

  if (sourceUserId && email) {
    console.log(`[ERP inventory] resolving user email=${email} sourceUserId=${sourceUserId}`);
    let resolved;
    try {
      resolved = await resolvePerformedBy({
        source_system: sourceSystem,
        source_user_id: sourceUserId,
        email,
      });
    } catch (e) {
      console.error('[ERP inventory] resolvePerformedBy threw:', e instanceof Error ? e.message : String(e));
      return NextResponse.json({ error: 'User resolution failed' }, { status: 500 });
    }
    if (!resolved) {
      console.error(`[ERP inventory] Cannot resolve WMS user for email=${email}`);
      return NextResponse.json({ error: `Cannot resolve WMS user for email: ${email}` }, { status: 422 });
    }
    console.log(`[ERP inventory] resolved wms_user_id=${resolved.wms_user_id}`);
    userId = resolved.wms_user_id;
  } else {
    const systemUserId = process.env.ERP_SYSTEM_USER_ID;
    if (!systemUserId) {
      console.error('[ERP inventory] ERP_SYSTEM_USER_ID not configured and performed_by not provided');
      return NextResponse.json({ error: 'ERP_SYSTEM_USER_ID not configured and performed_by not provided' }, { status: 500 });
    }
    userId = systemUserId;
  }

  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from('inventory')
    .select('product_id, current_stock, allocated_qty, updated_at, products!inner(id, name, user_id)')
    .eq('products.user_id', userId);

  if (error) {
    console.error('[ERP inventory] query error:', error);
    return NextResponse.json({ error: 'Failed to fetch inventory', detail: error.message }, { status: 500 });
  }

  const items = ((data ?? []) as unknown as InventoryRow[]).map((row) => ({
    product_id: row.product_id,
    product_name: row.products?.name ?? '',
    current_stock: row.current_stock,
    allocated_qty: row.allocated_qty ?? 0,
    available_qty: row.current_stock - (row.allocated_qty ?? 0),
    updated_at: row.updated_at,
  }));

  console.log(`[ERP inventory] ok count=${items.length} userId=${userId}`);
  return NextResponse.json(items);
}
