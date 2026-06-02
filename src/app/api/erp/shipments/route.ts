import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';
import { resolvePerformedBy, logErpAudit, PerformedBy } from '@/lib/erp-user-resolver';

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
  performed_by?: PerformedBy;
}

interface ShipmentLineInsert {
  shipment_id: number;
  product_id: number;
  product_name: string;
  quantity: number;
  user_id: string;
}

export async function POST(req: NextRequest) {
  const apiKey = req.headers.get('x-api-key');
  if (!apiKey || apiKey !== process.env.ERP_API_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: ShipmentPayload;
  try {
    body = await req.json() as ShipmentPayload;
  } catch (_e) {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (!body.external_ref_no || !body.scheduled_date || !body.lines?.length) {
    return NextResponse.json({ error: 'Missing required fields: external_ref_no, scheduled_date, lines' }, { status: 400 });
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

  let destinationId: number | null = null;
  let destinationName = body.destination_name ?? null;
  if (body.destination_name) {
    const { data: dest } = await supabase
      .from('delivery_destinations')
      .select('id, name')
      .eq('user_id', userId)
      .ilike('name', body.destination_name)
      .limit(1)
      .single();
    if (dest) {
      destinationId = (dest as { id: number; name: string }).id;
      destinationName = (dest as { id: number; name: string }).name;
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

  const shipmentNo = `ERP-SHP-${body.external_ref_no}-${Date.now()}`;

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
      user_id: userId,
    })
    .select('id, shipment_no')
    .single();

  if (shipmentError || !shipment) {
    console.error('[ERP shipments] insert error:', shipmentError);
    return NextResponse.json({ error: 'Failed to create shipment', detail: shipmentError?.message }, { status: 500 });
  }

  const s = shipment as { id: number; shipment_no: string };
  const lineInserts: ShipmentLineInsert[] = [];

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
      await supabase.from('shipments').delete().eq('id', s.id);
      return NextResponse.json(
        { error: `Product not found in WMS: ${line.product_name}` },
        { status: 422 }
      );
    }

    lineInserts.push({
      shipment_id: s.id,
      product_id: productId,
      product_name: productName,
      quantity: line.quantity,
      user_id: userId,
    });
  }

  const { data: lines, error: linesError } = await supabase
    .from('shipment_lines')
    .insert(lineInserts)
    .select('id');

  if (linesError) {
    await supabase.from('shipments').delete().eq('id', s.id);
    console.error('[ERP shipments] lines insert error:', linesError);
    return NextResponse.json({ error: 'Failed to create shipment lines', detail: linesError.message }, { status: 500 });
  }

  if (body.performed_by) {
    await logErpAudit({
      source_system: body.performed_by.source_system,
      source_user_id: body.performed_by.source_user_id,
      wms_user_id: userId,
      email: resolvedEmail,
      action: 'create_shipment',
      entity_type: 'shipment',
      entity_id: s.id,
      details: { shipment_no: s.shipment_no, external_ref_no: body.external_ref_no },
    });
  }

  return NextResponse.json({
    shipment_id: s.id,
    shipment_no: s.shipment_no,
    line_ids: (lines as { id: number }[] ?? []).map((l) => l.id),
  });
}
