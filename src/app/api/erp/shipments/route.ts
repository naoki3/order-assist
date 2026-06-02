import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';

interface ShipmentLine {
  product_id?: number;
  product_name: string;
  quantity: number;
}

interface ShipmentPayload {
  external_ref_no: string;
  destination_name?: string;
  warehouse_name?: string;
  scheduled_date: string;
  note?: string;
  lines: ShipmentLine[];
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

  let body: ShipmentPayload;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (!body.external_ref_no || !body.scheduled_date || !body.lines?.length) {
    return NextResponse.json({ error: 'Missing required fields: external_ref_no, scheduled_date, lines' }, { status: 400 });
  }

  const supabase = createAdminClient();

  // Resolve destination_id if destination_name provided
  let destinationId: number | null = null;
  let destinationName = body.destination_name ?? null;
  if (body.destination_name) {
    const { data: dest } = await supabase
      .from('delivery_destinations')
      .select('id, name')
      .eq('user_id', systemUserId)
      .ilike('name', body.destination_name)
      .limit(1)
      .single();
    if (dest) {
      destinationId = dest.id;
      destinationName = dest.name;
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

  // Generate shipment_no
  const shipmentNo = `ERP-SHP-${body.external_ref_no}-${Date.now()}`;

  // Create shipment header
  const { data: shipment, error: shipmentError } = await supabase
    .from('shipments')
    .insert({
      shipment_no: shipmentNo,
      shipment_type: 'normal',
      status: 'requested',
      destination_id: destinationId,
      destination_name: destinationName,
      warehouse_id: warehouseId,
      warehouse_name: warehouseName,
      external_ref_no: body.external_ref_no,
      source_system: 'api',
      scheduled_date: body.scheduled_date,
      note: body.note ?? null,
      user_id: systemUserId,
    })
    .select('id, shipment_no')
    .single();

  if (shipmentError || !shipment) {
    console.error('[ERP shipments] insert error:', shipmentError);
    return NextResponse.json({ error: 'Failed to create shipment', detail: shipmentError?.message }, { status: 500 });
  }

  // Resolve products and create shipment lines
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
      await supabase.from('shipments').delete().eq('id', shipment.id);
      return NextResponse.json(
        { error: `Product not found in WMS: ${line.product_name}` },
        { status: 422 }
      );
    }

    lineInserts.push({
      shipment_id: shipment.id,
      product_id: productId,
      product_name: productName,
      quantity: line.quantity,
      user_id: systemUserId,
    });
  }

  const { data: lines, error: linesError } = await supabase
    .from('shipment_lines')
    .insert(lineInserts)
    .select('id');

  if (linesError) {
    await supabase.from('shipments').delete().eq('id', shipment.id);
    console.error('[ERP shipments] lines insert error:', linesError);
    return NextResponse.json({ error: 'Failed to create shipment lines', detail: linesError.message }, { status: 500 });
  }

  return NextResponse.json({
    shipment_id: shipment.id,
    shipment_no: shipment.shipment_no,
    line_ids: lines?.map((l: { id: number }) => l.id) ?? [],
  });
}
