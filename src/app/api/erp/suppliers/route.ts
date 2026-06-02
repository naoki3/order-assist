import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';
import { resolvePerformedBy, PerformedBy } from '@/lib/erp-user-resolver';

interface SupplierBody {
  name: string;
  contact_name?: string;
  email?: string;
  phone?: string;
  address?: string;
  note?: string;
  performed_by?: PerformedBy;
}

interface SupplierPatchBody {
  wms_supplier_id: number;
  name?: string;
  contact_name?: string;
  email?: string;
  phone?: string;
  address?: string;
  note?: string;
  performed_by?: PerformedBy;
}

function requireApiKey(req: NextRequest): NextResponse | null {
  const apiKey = req.headers.get('x-api-key');
  if (!apiKey || apiKey !== process.env.ERP_API_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return null;
}

async function resolveUser(performed_by?: PerformedBy): Promise<{ userId: string } | NextResponse> {
  if (performed_by) {
    const resolved = await resolvePerformedBy(performed_by);
    if (!resolved) {
      return NextResponse.json({ error: `Cannot resolve WMS user for email: ${performed_by.email}` }, { status: 422 });
    }
    return { userId: resolved.wms_user_id };
  }
  const systemUserId = process.env.ERP_SYSTEM_USER_ID;
  if (!systemUserId) {
    return NextResponse.json({ error: 'ERP_SYSTEM_USER_ID not configured and performed_by not provided' }, { status: 500 });
  }
  return { userId: systemUserId };
}

export async function GET(req: NextRequest) {
  const denied = requireApiKey(req);
  if (denied) return denied;

  const url = new URL(req.url);
  const sourceUserId = url.searchParams.get('source_user_id');
  const email = url.searchParams.get('email');
  const sourceSystem = url.searchParams.get('source_system') ?? 'ERP';

  let userId: string;
  if (sourceUserId && email) {
    const resolved = await resolvePerformedBy({ source_system: sourceSystem, source_user_id: sourceUserId, email });
    if (!resolved) return NextResponse.json({ error: `Cannot resolve WMS user for email: ${email}` }, { status: 422 });
    userId = resolved.wms_user_id;
  } else {
    const systemUserId = process.env.ERP_SYSTEM_USER_ID;
    if (!systemUserId) return NextResponse.json({ error: 'ERP_SYSTEM_USER_ID not configured' }, { status: 500 });
    userId = systemUserId;
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('suppliers')
    .select('id, name, contact_name, email, phone, address, note')
    .eq('user_id', userId)
    .order('name');

  if (error) {
    console.error('[ERP suppliers] list error:', error);
    return NextResponse.json({ error: 'Failed to fetch suppliers', detail: error.message }, { status: 500 });
  }

  const suppliers = ((data ?? []) as { id: number; name: string; contact_name: string | null; email: string | null; phone: string | null; address: string | null; note: string | null }[]).map((s) => ({
    supplier_id: s.id,
    name: s.name,
    contact_name: s.contact_name,
    email: s.email,
    phone: s.phone,
    address: s.address,
    note: s.note,
  }));

  console.log(`[ERP suppliers] list ok count=${suppliers.length} userId=${userId}`);
  return NextResponse.json(suppliers);
}

export async function POST(req: NextRequest) {
  const denied = requireApiKey(req);
  if (denied) return denied;

  let body: SupplierBody;
  try { body = await req.json() as SupplierBody; } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  if (!body.name?.trim()) return NextResponse.json({ error: 'Missing required field: name' }, { status: 400 });

  const res = await resolveUser(body.performed_by);
  if (res instanceof NextResponse) return res;
  const { userId } = res;

  const supabase = createAdminClient();

  // Upsert: if same name exists for this user, update and return
  const { data: existing } = await supabase
    .from('suppliers')
    .select('id, name')
    .eq('user_id', userId)
    .ilike('name', body.name.trim())
    .maybeSingle();

  if (existing) {
    const s = existing as { id: number; name: string };
    const updates: Record<string, unknown> = {};
    if (body.contact_name !== undefined) updates.contact_name = body.contact_name;
    if (body.email !== undefined) updates.email = body.email;
    if (body.phone !== undefined) updates.phone = body.phone;
    if (body.address !== undefined) updates.address = body.address;
    if (body.note !== undefined) updates.note = body.note;
    if (Object.keys(updates).length > 0) {
      await supabase.from('suppliers').update(updates).eq('id', s.id);
    }
    console.log(`[ERP suppliers] upserted (existing) supplier_id=${s.id} name=${s.name}`);
    return NextResponse.json({ supplier_id: s.id, name: s.name });
  }

  const { data: supplier, error } = await supabase
    .from('suppliers')
    .insert({
      name: body.name.trim(),
      contact_name: body.contact_name ?? null,
      email: body.email ?? null,
      phone: body.phone ?? null,
      address: body.address ?? null,
      note: body.note ?? null,
      user_id: userId,
    })
    .select('id, name')
    .single();

  if (error || !supplier) {
    console.error('[ERP suppliers] insert error:', error);
    return NextResponse.json({ error: 'Failed to create supplier', detail: error?.message }, { status: 500 });
  }

  const s = supplier as { id: number; name: string };
  console.log(`[ERP suppliers] created supplier_id=${s.id} name=${s.name}`);
  return NextResponse.json({ supplier_id: s.id, name: s.name }, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const denied = requireApiKey(req);
  if (denied) return denied;

  let body: SupplierPatchBody;
  try { body = await req.json() as SupplierPatchBody; } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  if (!body.wms_supplier_id) return NextResponse.json({ error: 'Missing required field: wms_supplier_id' }, { status: 400 });

  const res = await resolveUser(body.performed_by);
  if (res instanceof NextResponse) return res;
  const { userId } = res;

  const updates: Record<string, unknown> = {};
  if (body.name !== undefined) updates.name = body.name.trim();
  if (body.contact_name !== undefined) updates.contact_name = body.contact_name;
  if (body.email !== undefined) updates.email = body.email;
  if (body.phone !== undefined) updates.phone = body.phone;
  if (body.address !== undefined) updates.address = body.address;
  if (body.note !== undefined) updates.note = body.note;

  if (Object.keys(updates).length === 0) return NextResponse.json({ error: 'No fields to update' }, { status: 400 });

  const supabase = createAdminClient();
  const { data: supplier, error } = await supabase
    .from('suppliers')
    .update(updates)
    .eq('id', body.wms_supplier_id)
    .eq('user_id', userId)
    .select('id, name')
    .single();

  if (error) {
    console.error('[ERP suppliers] update error:', error);
    return NextResponse.json({ error: 'Failed to update supplier', detail: error.message }, { status: 500 });
  }
  if (!supplier) return NextResponse.json({ error: 'Supplier not found' }, { status: 404 });

  const s = supplier as { id: number; name: string };
  console.log(`[ERP suppliers] updated supplier_id=${s.id} name=${s.name}`);
  return NextResponse.json({ supplier_id: s.id, name: s.name });
}
