import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';
import { resolvePerformedBy, logErpAudit, PerformedBy } from '@/lib/erp-user-resolver';

interface ReceiptLine {
  product_id?: number;
  product_name: string;
  expected_qty: number;
  lot_number?: string;
  expiry_date?: string;
}

interface ReceiptPayload {
  external_ref_no: string;
  supplier_name?: string;
  warehouse_name?: string;
  expected_date: string;
  note?: string;
  lines: ReceiptLine[];
  performed_by?: PerformedBy;
}

interface ReceiptLineInsert {
  receipt_id: number;
  product_id: number;
  product_name: string;
  expected_qty: number;
  lot_number: string | null;
  expiry_date: string | null;
  user_id: string;
}

export async function POST(req: NextRequest) {
  const apiKey = req.headers.get('x-api-key');
  if (!apiKey || apiKey !== process.env.ERP_API_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: ReceiptPayload;
  try {
    body = await req.json() as ReceiptPayload;
  } catch (_e) {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (!body.external_ref_no || !body.expected_date || !body.lines?.length) {
    return NextResponse.json({ error: 'Missing required fields: external_ref_no, expected_date, lines' }, { status: 400 });
  }

  let userId: string;
  let resolvedEmail: string | null = null;

  if (body.performed_by) {
    const resolved = await resolvePerformedBy(body.performed_by);
    if (!resolved) {
      return NextResponse.json(
        { error: `Cannot resolve WMS user for email: ${body.performed_by.email}` },
        { status: 422 }
      );
    }
    userId = resolved.wms_user_id;
    resolvedEmail = resolved.email;
  } else {
    const systemUserId = process.env.ERP_SYSTEM_USER_ID;
    if (!systemUserId) {
      return NextResponse.json({ error: 'ERP_SYSTEM_USER_ID not configured and performed_by not provided' }, { status: 500 });
    }
    userId = systemUserId;
  }

  const supabase = createAdminClient();

  let supplierId: number | null = null;
  let supplierName = body.supplier_name ?? null;
  if (body.supplier_name) {
    const { data: supplier } = await supabase
      .from('suppliers')
      .select('id, name')
      .eq('user_id', userId)
      .ilike('name', body.supplier_name)
      .limit(1)
      .single();
    if (supplier) {
      supplierId = (supplier as { id: number; name: string }).id;
      supplierName = (supplier as { id: number; name: string }).name;
    }
  }

  let warehouseId: number | null = null;
  let warehouseName = body.warehouse_name ?? null;
  if (body.warehouse_name) {
    const { data: warehouse } = await supabase
      .from('warehouses')
      .select('id, name')
      .eq('user_id', userId)
      .ilike('name', body.warehouse_name)
      .limit(1)
      .single();
    if (warehouse) {
      warehouseId = (warehouse as { id: number; name: string }).id;
      warehouseName = (warehouse as { id: number; name: string }).name;
    }
  }

  const receiptNo = `ERP-RCV-${body.external_ref_no}-${Date.now()}`;

  const { data: receipt, error: receiptError } = await supabase
    .from('receipts')
    .insert({
      receipt_no: receiptNo,
      receipt_type: 'planned',
      status: 'expected',
      supplier_id: supplierId,
      supplier_name: supplierName,
      warehouse_id: warehouseId,
      warehouse_name: warehouseName,
      external_ref_no: body.external_ref_no,
      source_system: 'api',
      expected_date: body.expected_date,
      note: body.note ?? null,
      user_id: userId,
    })
    .select('id, receipt_no')
    .single();

  if (receiptError || !receipt) {
    console.error('[ERP receipts] insert error:', receiptError);
    return NextResponse.json({ error: 'Failed to create receipt', detail: receiptError?.message }, { status: 500 });
  }

  const r = receipt as { id: number; receipt_no: string };
  const lineInserts: ReceiptLineInsert[] = [];

  for (const line of body.lines) {
    let productId = line.product_id ?? null;
    let productName = line.product_name;

    if (!productId) {
      const { data: product } = await supabase
        .from('products')
        .select('id, name')
        .eq('user_id', userId)
        .ilike('name', line.product_name)
        .limit(1)
        .single();
      if (product) {
        productId = (product as { id: number; name: string }).id;
        productName = (product as { id: number; name: string }).name;
      }
    }

    if (!productId) {
      await supabase.from('receipts').delete().eq('id', r.id);
      return NextResponse.json(
        { error: `Product not found in WMS: ${line.product_name}` },
        { status: 422 }
      );
    }

    lineInserts.push({
      receipt_id: r.id,
      product_id: productId,
      product_name: productName,
      expected_qty: line.expected_qty,
      lot_number: line.lot_number ?? null,
      expiry_date: line.expiry_date ?? null,
      user_id: userId,
    });
  }

  const { data: lines, error: linesError } = await supabase
    .from('receipt_lines')
    .insert(lineInserts)
    .select('id');

  if (linesError) {
    await supabase.from('receipts').delete().eq('id', r.id);
    console.error('[ERP receipts] lines insert error:', linesError);
    return NextResponse.json({ error: 'Failed to create receipt lines', detail: linesError.message }, { status: 500 });
  }

  if (body.performed_by) {
    await logErpAudit({
      source_system: body.performed_by.source_system,
      source_user_id: body.performed_by.source_user_id,
      wms_user_id: userId,
      email: resolvedEmail,
      action: 'create_receipt',
      entity_type: 'receipt',
      entity_id: r.id,
      details: { receipt_no: r.receipt_no, external_ref_no: body.external_ref_no },
    });
  }

  return NextResponse.json({
    receipt_id: r.id,
    receipt_no: r.receipt_no,
    line_ids: (lines as { id: number }[] ?? []).map((l) => l.id),
  });
}
