import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';
import { resolvePerformedBy, PerformedBy } from '@/lib/erp-user-resolver';

interface ProductBody {
  name: string;
  price?: number;
  lead_time_days?: number;
  safety_stock_days?: number;
  performed_by?: PerformedBy;
}

interface ProductPatchBody {
  wms_product_id: number;
  name?: string;
  price?: number;
  lead_time_days?: number;
  safety_stock_days?: number;
  performed_by?: PerformedBy;
}

async function resolveUser(performed_by?: PerformedBy): Promise<{ userId: string } | NextResponse> {
  if (performed_by) {
    const resolved = await resolvePerformedBy(performed_by);
    if (!resolved) {
      return NextResponse.json(
        { error: `Cannot resolve WMS user for email: ${performed_by.email}` },
        { status: 422 }
      );
    }
    return { userId: resolved.wms_user_id };
  }
  const systemUserId = process.env.ERP_SYSTEM_USER_ID;
  if (!systemUserId) {
    return NextResponse.json(
      { error: 'ERP_SYSTEM_USER_ID not configured and performed_by not provided' },
      { status: 500 }
    );
  }
  return { userId: systemUserId };
}

function requireApiKey(req: NextRequest): NextResponse | null {
  const apiKey = req.headers.get('x-api-key');
  if (!apiKey || apiKey !== process.env.ERP_API_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return null;
}

export async function POST(req: NextRequest) {
  const denied = requireApiKey(req);
  if (denied) return denied;

  let body: ProductBody;
  try {
    body = await req.json() as ProductBody;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (!body.name?.trim()) {
    return NextResponse.json({ error: 'Missing required field: name' }, { status: 400 });
  }

  const res = await resolveUser(body.performed_by);
  if (res instanceof NextResponse) return res;
  const { userId } = res;

  const supabase = createAdminClient();
  const { data: product, error } = await supabase
    .from('products')
    .insert({
      name: body.name.trim(),
      price: body.price ?? null,
      lead_time_days: body.lead_time_days ?? 2,
      safety_stock_days: body.safety_stock_days ?? 1,
      user_id: userId,
    })
    .select('id, name')
    .single();

  if (error || !product) {
    console.error('[ERP products] insert error:', error);
    return NextResponse.json({ error: 'Failed to create product', detail: error?.message }, { status: 500 });
  }

  const p = product as { id: number; name: string };
  console.log(`[ERP products] created product_id=${p.id} name=${p.name}`);
  return NextResponse.json({ product_id: p.id, name: p.name }, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const denied = requireApiKey(req);
  if (denied) return denied;

  let body: ProductPatchBody;
  try {
    body = await req.json() as ProductPatchBody;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (!body.wms_product_id) {
    return NextResponse.json({ error: 'Missing required field: wms_product_id' }, { status: 400 });
  }

  const res = await resolveUser(body.performed_by);
  if (res instanceof NextResponse) return res;
  const { userId } = res;

  const updates: Record<string, unknown> = {};
  if (body.name !== undefined) updates.name = body.name.trim();
  if (body.price !== undefined) updates.price = body.price;
  if (body.lead_time_days !== undefined) updates.lead_time_days = body.lead_time_days;
  if (body.safety_stock_days !== undefined) updates.safety_stock_days = body.safety_stock_days;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data: product, error } = await supabase
    .from('products')
    .update(updates)
    .eq('id', body.wms_product_id)
    .eq('user_id', userId)
    .select('id, name')
    .single();

  if (error) {
    console.error('[ERP products] update error:', error);
    return NextResponse.json({ error: 'Failed to update product', detail: error.message }, { status: 500 });
  }
  if (!product) {
    return NextResponse.json({ error: 'Product not found' }, { status: 404 });
  }

  const p = product as { id: number; name: string };
  console.log(`[ERP products] updated product_id=${p.id} name=${p.name}`);
  return NextResponse.json({ product_id: p.id, name: p.name });
}
