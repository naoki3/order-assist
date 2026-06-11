import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

// Temporary seeding endpoint — preview deployment only, never merge to main.
const SEED_SECRET = '6e1dfa8aa24544c127b2d3f177a982f8';

const TEST_EMAIL = 'test@example.com';
const TEST_PASSWORD = 'test1234';

function dateStr(offsetDays: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

function voucherNo(prefix: string, date: string, i: number): string {
  return `${prefix}-${date.replace(/-/g, '')}-TEST${String(i).padStart(2, '0')}`;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  if (url.searchParams.get('secret') !== SEED_SECRET) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const admin = createAdminClient();
  const log: string[] = [];
  const fail = (step: string, message: string) =>
    NextResponse.json({ error: `${step}: ${message}`, log }, { status: 500 });

  // 1. Create auth user (no confirmation email — admin API confirms directly)
  let userId: string;
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email: TEST_EMAIL,
    password: TEST_PASSWORD,
    email_confirm: true,
  });
  if (createErr) {
    const { data: list } = await admin.auth.admin.listUsers();
    const existing = list?.users.find((u) => u.email === TEST_EMAIL);
    if (!existing) return fail('createUser', createErr.message);
    userId = existing.id;
    log.push(`user already exists: ${userId}`);
    const { count } = await admin
      .from('products')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId);
    if ((count ?? 0) > 0) {
      return NextResponse.json({ ok: true, skipped: 'user already has data', userId, log });
    }
  } else {
    userId = created.user.id;
    log.push(`user created: ${userId}`);
  }

  // 2. Profile (owner = own tenant, treated as admin by auth-guard)
  const { error: profErr } = await admin.from('user_profiles').insert({
    user_id: userId,
    auth_user_id: userId,
    name: 'テストユーザー',
    email: TEST_EMAIL,
    role: 'admin',
    note: 'デモデータ入りテストアカウント',
  });
  if (profErr) log.push(`user_profiles: ${profErr.message}`);

  // 3. Masters
  const { data: warehouses, error: whErr } = await admin
    .from('warehouses')
    .insert([
      { user_id: userId, name: '東京第1倉庫', address: '東京都江東区新木場1-2-3' },
      { user_id: userId, name: '大阪倉庫', address: '大阪府大阪市住之江区南港北2-1-10' },
    ])
    .select('id, name');
  if (whErr || !warehouses) return fail('warehouses', whErr?.message ?? 'no data');
  const tokyo = warehouses[0];

  const { data: locations, error: locErr } = await admin
    .from('locations')
    .insert(
      warehouses.flatMap((w) =>
        ['A-1', 'A-2', 'B-1'].map((name) => ({ user_id: userId, warehouse_id: w.id, name }))
      )
    )
    .select('id, name, warehouse_id');
  if (locErr || !locations) return fail('locations', locErr?.message ?? 'no data');
  const tokyoLoc = locations.find((l) => l.warehouse_id === tokyo.id)!;

  const { data: suppliers, error: supErr } = await admin
    .from('suppliers')
    .insert([
      { user_id: userId, name: '山田乳業', contact_name: '山田太郎', phone: '03-1111-2222' },
      { user_id: userId, name: '鈴木製パン', contact_name: '鈴木花子', phone: '03-3333-4444' },
      { user_id: userId, name: 'フード卸センター', phone: '06-5555-6666' },
    ])
    .select('id, name');
  if (supErr || !suppliers) return fail('suppliers', supErr?.message ?? 'no data');

  const { data: carriers, error: carErr } = await admin
    .from('carriers')
    .insert([
      { user_id: userId, name: 'ヤマト運輸' },
      { user_id: userId, name: '佐川急便' },
    ])
    .select('id, name');
  if (carErr || !carriers) return fail('carriers', carErr?.message ?? 'no data');

  const { data: destinations, error: dstErr } = await admin
    .from('delivery_destinations')
    .insert([
      { user_id: userId, name: 'スーパーマルシェ駅前店', address: '東京都新宿区西新宿1-1-1' },
      { user_id: userId, name: 'コンビニABC中央店', address: '東京都中央区銀座4-5-6' },
      { user_id: userId, name: 'ドラッグストアXYZ', address: '神奈川県横浜市西区みなとみらい2-3-4' },
    ])
    .select('id, name');
  if (dstErr || !destinations) return fail('destinations', dstErr?.message ?? 'no data');

  // Default statuses are seeded by the on_auth_user_created trigger
  const { data: statuses } = await admin
    .from('inventory_statuses')
    .select('id, name, color')
    .eq('user_id', userId);
  const goodStatus = statuses?.find((s) => s.name === '良品') ?? null;

  // 4. Products
  const productDefs = [
    { name: '牛乳 1L', price: 248, lead_time_days: 2, safety_stock_days: 1, shelf_life_days: 14, baseSales: 14 },
    { name: '食パン 6枚切', price: 158, lead_time_days: 1, safety_stock_days: 1, shelf_life_days: 5, baseSales: 22 },
    { name: 'たまご 10個パック', price: 298, lead_time_days: 3, safety_stock_days: 2, shelf_life_days: 21, baseSales: 10 },
    { name: 'ヨーグルト 400g', price: 188, lead_time_days: 2, safety_stock_days: 1, shelf_life_days: 18, baseSales: 8 },
    { name: 'オレンジジュース 1L', price: 218, lead_time_days: 2, safety_stock_days: 1, shelf_life_days: 30, baseSales: 5 },
    { name: 'バター 200g', price: 480, lead_time_days: 4, safety_stock_days: 2, shelf_life_days: 90, baseSales: 3 },
    { name: 'スライスチーズ 7枚', price: 358, lead_time_days: 3, safety_stock_days: 1, shelf_life_days: 60, baseSales: 4 },
    { name: '冷凍うどん 5食', price: 398, lead_time_days: 5, safety_stock_days: 2, shelf_life_days: 180, baseSales: 6 },
  ];
  const { data: products, error: prodErr } = await admin
    .from('products')
    .insert(
      productDefs.map((p) => ({
        user_id: userId,
        name: p.name,
        price: p.price,
        lead_time_days: p.lead_time_days,
        safety_stock_days: p.safety_stock_days,
        shelf_life_days: p.shelf_life_days,
        default_warehouse_id: tokyo.id,
        default_warehouse_name: tokyo.name,
      }))
    )
    .select('id, name, shelf_life_days');
  if (prodErr || !products) return fail('products', prodErr?.message ?? 'no data');
  log.push(`products: ${products.length}`);

  // 5. Sales history (past 30 days, deterministic wave pattern)
  const salesRows = [];
  for (let d = 30; d >= 1; d--) {
    const date = dateStr(-d);
    for (let i = 0; i < products.length; i++) {
      const base = productDefs[i].baseSales;
      const qty = Math.max(1, Math.round(base + Math.sin((d + i * 3) / 3) * base * 0.3 + ((d * 7 + i * 13) % 5) - 2));
      salesRows.push({ user_id: userId, product_id: products[i].id, date, quantity: qty });
    }
  }
  const { error: salesErr } = await admin.from('sales').insert(salesRows);
  if (salesErr) return fail('sales', salesErr.message);
  log.push(`sales: ${salesRows.length}`);

  // 6. Received receipts (past) — lots/inventory/transactions built by fn_receive_receipt_line
  const receiptPlans = [
    { offset: -21, supplier: suppliers[0], productIdx: [0, 1, 2] },
    { offset: -14, supplier: suppliers[1], productIdx: [3, 4, 5] },
    { offset: -7, supplier: suppliers[2], productIdx: [6, 7, 0, 1] },
  ];
  let receiptCount = 0;
  for (let r = 0; r < receiptPlans.length; r++) {
    const plan = receiptPlans[r];
    const rDate = dateStr(plan.offset);
    const { data: receipt, error: rErr } = await admin
      .from('receipts')
      .insert({
        user_id: userId,
        receipt_no: voucherNo('RCV', rDate, r + 1),
        expected_date: rDate,
        supplier_id: plan.supplier.id,
        supplier_name: plan.supplier.name,
        warehouse_id: tokyo.id,
        warehouse_name: tokyo.name,
      })
      .select('id')
      .single();
    if (rErr || !receipt) return fail('receipts', rErr?.message ?? 'no data');

    for (const pi of plan.productIdx) {
      const product = products[pi];
      const qty = 60 + ((pi * 17 + r * 29) % 60);
      const { data: line, error: lErr } = await admin
        .from('receipt_lines')
        .insert({
          user_id: userId,
          receipt_id: receipt.id,
          product_id: product.id,
          product_name: product.name,
          expected_qty: qty,
        })
        .select('id')
        .single();
      if (lErr || !line) return fail('receipt_lines', lErr?.message ?? 'no data');

      const expiry = new Date();
      expiry.setDate(expiry.getDate() + plan.offset + (product.shelf_life_days ?? 30));
      const { data: rcv, error: rcvErr } = await admin.rpc('fn_receive_receipt_line', {
        p_receipt_line_id: line.id,
        p_lot_number: `LOT-${rDate.replace(/-/g, '')}-${String(pi + 1).padStart(2, '0')}`,
        p_expiry_date: expiry.toISOString().slice(0, 10),
        p_location_id: tokyoLoc.id,
        p_location_name: tokyoLoc.name,
        p_warehouse_id: tokyo.id,
        p_warehouse_name: tokyo.name,
        p_local_today: rDate,
        p_owner_id: userId,
        p_operation_id: crypto.randomUUID(),
        p_status_id: goodStatus?.id ?? null,
        p_status_name: goodStatus?.name ?? null,
        p_status_color: goodStatus?.color ?? null,
        p_received_qty: qty,
      });
      if (rcvErr) return fail('fn_receive_receipt_line', rcvErr.message);
      const rcvResult = rcv as { ok?: boolean; error?: string } | null;
      if (rcvResult?.error) return fail('fn_receive_receipt_line', rcvResult.error);
    }
    receiptCount++;
  }
  log.push(`received receipts: ${receiptCount}`);

  // 7. Upcoming expected receipt (stays in 入荷予定)
  {
    const rDate = dateStr(3);
    const { data: receipt, error: rErr } = await admin
      .from('receipts')
      .insert({
        user_id: userId,
        receipt_no: voucherNo('RCV', rDate, 9),
        expected_date: rDate,
        supplier_id: suppliers[0].id,
        supplier_name: suppliers[0].name,
        warehouse_id: tokyo.id,
        warehouse_name: tokyo.name,
      })
      .select('id')
      .single();
    if (rErr || !receipt) return fail('expected receipt', rErr?.message ?? 'no data');
    const { error: lErr } = await admin.from('receipt_lines').insert(
      [0, 3].map((pi) => ({
        user_id: userId,
        receipt_id: receipt.id,
        product_id: products[pi].id,
        product_name: products[pi].name,
        expected_qty: 80,
      }))
    );
    if (lErr) return fail('expected receipt_lines', lErr.message);
    log.push('expected receipt: 1');
  }

  // 8. Shipments: 2 shipped (allocate → confirm), 1 requested
  const shipmentPlans = [
    { offset: -5, dest: destinations[0], carrier: carriers[0], lines: [{ pi: 0, qty: 20 }, { pi: 1, qty: 30 }, { pi: 2, qty: 15 }], ship: true },
    { offset: -2, dest: destinations[1], carrier: carriers[1], lines: [{ pi: 3, qty: 12 }, { pi: 5, qty: 8 }], ship: true },
    { offset: 2, dest: destinations[2], carrier: carriers[0], lines: [{ pi: 6, qty: 10 }, { pi: 7, qty: 14 }], ship: false },
  ];
  let shippedCount = 0;
  for (let s = 0; s < shipmentPlans.length; s++) {
    const plan = shipmentPlans[s];
    const sDate = dateStr(plan.offset);
    const { data: shipment, error: sErr } = await admin
      .from('shipments')
      .insert({
        user_id: userId,
        shipment_no: voucherNo('SHP', sDate, s + 1),
        scheduled_date: sDate,
        destination_id: plan.dest.id,
        destination_name: plan.dest.name,
        carrier_id: plan.carrier.id,
        carrier_name: plan.carrier.name,
        warehouse_id: tokyo.id,
        warehouse_name: tokyo.name,
      })
      .select('id')
      .single();
    if (sErr || !shipment) return fail('shipments', sErr?.message ?? 'no data');

    const lineIds: number[] = [];
    for (const l of plan.lines) {
      const { data: line, error: lErr } = await admin
        .from('shipment_lines')
        .insert({
          user_id: userId,
          shipment_id: shipment.id,
          product_id: products[l.pi].id,
          product_name: products[l.pi].name,
          quantity: l.qty,
          warehouse_id: tokyo.id,
          warehouse_name: tokyo.name,
        })
        .select('id')
        .single();
      if (lErr || !line) return fail('shipment_lines', lErr?.message ?? 'no data');
      lineIds.push(line.id);
    }

    if (!plan.ship) continue;

    for (const lineId of lineIds) {
      const { data: alloc, error: aErr } = await admin.rpc('fn_allocate_shipment_line', {
        p_line_id: lineId,
        p_operation_id: crypto.randomUUID(),
        p_local_today: sDate,
      });
      if (aErr) return fail('fn_allocate_shipment_line', aErr.message);
      const aResult = alloc as { ok?: boolean; error?: string } | null;
      if (aResult?.error) return fail('fn_allocate_shipment_line', aResult.error);
    }

    const { data: conf, error: cErr } = await admin.rpc('fn_confirm_shipment', {
      p_shipment_id: shipment.id,
      p_operation_id: crypto.randomUUID(),
      p_local_today: sDate,
      p_ship_qtys: null,
    });
    if (cErr) return fail('fn_confirm_shipment', cErr.message);
    const cResult = conf as { ok?: boolean; error?: string } | null;
    if (cResult?.error) return fail('fn_confirm_shipment', cResult.error);
    shippedCount++;
  }
  log.push(`shipments: ${shipmentPlans.length} (shipped: ${shippedCount})`);

  return NextResponse.json({
    ok: true,
    account: { email: TEST_EMAIL, password: TEST_PASSWORD },
    log,
  });
}
