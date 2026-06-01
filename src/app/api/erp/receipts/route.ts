import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';

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
}

export async function POST(req: NextRequest) {
  const apiKey = req.headers.get('x-api-key');
  if (!apiKey || apiKey !== process.env.ERP_API_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const systemUserId = process.env.ERP_SYSTEM_USER_ID;
  if (!systemUserId) {
    return NextResponse.json({ error: 'ERP_SYSTEM_USER_ID not configured' }, { status: 500 });
  }

  let body: ReceiptPayload;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (!body.external_ref_no || !body.expected_date || !body.lines?.length) {
    return NextResponse.json({ error: 'Missing required fields: external_ref_no, expected_date, lines' }, { status: 400 });
  }

  const supabase = createAdminClient();

  // Resolve supplier_id if supplier_name provided
  let supplierId: number | null = null;
  let supplierName = body.supplier_name ?? null;
  if (body.supplier_name) {
    const { data: supplier } = await supabase
      .from('suppliers')
      .select('id, name')
      .eq('user_id', systemUserId)
      .ilike('name', body.supplier_name)
      .limit(1)
      .single();
    if (supplier) {
      supplierId = supplier.id;
      supplierName = supplier.name;
    }
  }

  // Resolve warehouse_id if warehouse_name provided
  let warehouseId: number | null = null;
  let warehouseName = body.warehouse_name ?? null;
  if (body.warehouse_name) {
    const { data: warehouse } = await supabase
      .from('warehouses')
      .select('id, name')
      .eq('user_id', systemUserId)
      .ilike('name', body.warehouse_name)
      .limit(1)
      .single();
    if (warehouse) {
      warehouseId = warehouse.id;
      warehouseName = warehouse.name;
    }
  }

  // Generate receipt_no
  const receiptNo = `ERP-RCV-${body.external_ref_no}-${Date.now()}`;

  // Create receipt header
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
      user_id: systemUserId,
    })
    .select('id, receipt_no')
    .single();

  if (receiptError || !receipt) {
    console.error('[ERP receipts] insert error:', receiptError);
    return NextResponse.json({ error: 'Failed to create receipt', detail: receiptError?.message }, { status: 500 });
  }

  // Resolve products and create receipt lines
  const lineInserts = [];
  for (const line of body.lines) {
    let productId = line.product_id ?? null;
    let productName = line.product_name;

    if (!productId) {
      const { data: product } = await supabase
        .from('products')
        .select('id, name')
        .eq('user_id', systemUserId)
        .ilike('name', line.product_name)
        .limit(1)
        .single();
      if (product) {
        productId = product.id;
        productName = product.name;
      }
    }

    if (!productId) {
      // Clean up the receipt we just created
      await supabase.from('receipts').delete().eq('id', receipt.id);
      return NextResponse.json(
        { error: `Product not found in WMS: ${line.product_name}` },
        { status: 422 }
      );
    }

    lineInserts.push({
      receipt_id: receipt.id,
      product_id: productId,
      product_name: productName,
      expected_qty: line.expected_qty,
      lot_number: line.lot_number ?? null,
      expiry_date: line.expiry_date ?? null,
      user_id: systemUserId,
    });
  }

  const { data: lines, error: linesError } = await supabase
    .from('receipt_lines')
    .insert(lineInserts)
    .select('id');

  if (linesError) {
    await supabase.from('receipts').delete().eq('id', receipt.id);
    console.error('[ERP receipts] lines insert error:', linesError);
    return NextResponse.json({ error: 'Failed to create receipt lines', detail: linesError.message }, { status: 500 });
  }

  return NextResponse.json({
    receipt_id: receipt.id,
    receipt_no: receipt.receipt_no,
    line_ids: lines?.map((l) => l.id) ?? [],
  });
}
