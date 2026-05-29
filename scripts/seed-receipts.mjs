/**
 * Seed script: generate ~600 past receipt records (1 year, 5 days/month, 10/day)
 * Run: node --env-file=.env.local scripts/seed-receipts.mjs
 *
 * Requires in .env.local:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

const sb = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ── helpers ──────────────────────────────────────────────────────────────────

function rand(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function addDays(dateStr, days) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function toDateStr(d) {
  return d.toISOString().slice(0, 10);
}

// ── main ─────────────────────────────────────────────────────────────────────

async function main() {
  // 1. Find owner (first user not in tenant_members as member)
  const { data: profiles } = await sb.from('user_profiles').select('auth_user_id, name');
  const { data: members }  = await sb.from('tenant_members').select('member_id');
  const memberIds = new Set((members ?? []).map(m => m.member_id));
  const owner = (profiles ?? []).find(p => !memberIds.has(p.auth_user_id));
  if (!owner) { console.error('No owner found'); process.exit(1); }
  const ownerId = owner.auth_user_id;
  console.log(`Owner: ${owner.name} (${ownerId})`);

  // 2. Fetch master data
  const [{ data: products }, { data: suppliers }, { data: warehouses }] = await Promise.all([
    sb.from('products').select('id, name, shelf_life_days').eq('user_id', ownerId).limit(50),
    sb.from('suppliers').select('id, name').eq('user_id', ownerId).limit(20),
    sb.from('warehouses').select('id, name').eq('user_id', ownerId).limit(10),
  ]);

  if (!products?.length)  { console.error('No products found — import products first'); process.exit(1); }
  if (!suppliers?.length) { console.error('No suppliers found — add suppliers first'); process.exit(1); }
  if (!warehouses?.length){ console.error('No warehouses found — add warehouses first'); process.exit(1); }

  console.log(`Products: ${products.length}, Suppliers: ${suppliers.length}, Warehouses: ${warehouses.length}`);

  // 3. Build date list: past 12 months, 5 days each month
  const today = new Date();
  const dates = [];
  for (let m = 11; m >= 0; m--) {
    const base = new Date(today.getFullYear(), today.getMonth() - m, 1);
    // Pick days: 2nd, 7th, 13th, 20th, 26th
    for (const day of [2, 7, 13, 20, 26]) {
      const d = new Date(base.getFullYear(), base.getMonth(), day);
      if (d < today) dates.push(toDateStr(d));
    }
  }
  console.log(`Dates to seed: ${dates.length} (${dates[0]} → ${dates[dates.length - 1]})`);

  // 4. Generate receipts
  let receiptCount = 0;
  let lineCount = 0;
  let errors = 0;

  for (const dateStr of dates) {
    const dateTag = dateStr.replace(/-/g, '');

    for (let i = 1; i <= 10; i++) {
      const supplier  = pick(suppliers);
      const warehouse = pick(warehouses);
      const receiptNo = `RC-${dateTag}-${String(i).padStart(3, '0')}`;

      // Insert receipt header
      const { data: receipt, error: rErr } = await sb.from('receipts').insert({
        receipt_no:     receiptNo,
        receipt_type:   'planned',
        status:         'received',
        supplier_id:    supplier.id,
        supplier_name:  supplier.name,
        warehouse_id:   warehouse.id,
        warehouse_name: warehouse.name,
        source_system:  'manual',
        expected_date:  dateStr,
        received_at:    `${dateStr}T10:00:00+09:00`,
        user_id:        ownerId,
      }).select('id').single();

      if (rErr || !receipt) {
        console.error(`  Receipt ${receiptNo}: ${rErr?.message}`);
        errors++;
        continue;
      }

      receiptCount++;

      // 1-3 lines per receipt
      const lineCount_ = rand(1, 3);
      const usedProducts = new Set();

      for (let l = 0; l < lineCount_; l++) {
        // Pick a product not yet used in this receipt
        let product;
        for (let attempt = 0; attempt < 10; attempt++) {
          product = pick(products);
          if (!usedProducts.has(product.id)) break;
        }
        if (usedProducts.has(product.id)) continue;
        usedProducts.add(product.id);

        const qty = rand(50, 300);
        const lotNumber = `${dateTag}-${String(receipt.id).slice(-4)}-${l + 1}`;
        const expiryDate = product.shelf_life_days
          ? addDays(dateStr, product.shelf_life_days)
          : null;

        // Insert receipt line
        const { data: line, error: lErr } = await sb.from('receipt_lines').insert({
          receipt_id:    receipt.id,
          product_id:    product.id,
          product_name:  product.name,
          supplier_name: supplier.name,
          quantity:      qty,
          received_qty:  qty,
          status:        'received',
          user_id:       ownerId,
        }).select('id').single();

        if (lErr || !line) {
          console.error(`  Line for ${product.name}: ${lErr?.message}`);
          errors++;
          continue;
        }

        // Call fn_receive_receipt_line to create lot + update inventory
        const { error: rpcErr } = await sb.rpc('fn_receive_receipt_line', {
          p_receipt_line_id: line.id,
          p_lot_number:      lotNumber,
          p_expiry_date:     expiryDate,
          p_location_id:     null,
          p_location_name:   null,
          p_warehouse_id:    warehouse.id,
          p_warehouse_name:  warehouse.name,
          p_local_today:     dateStr,
          p_owner_id:        ownerId,
          p_operation_id:    crypto.randomUUID(),
        });

        if (rpcErr) {
          console.error(`  fn_receive for lot ${lotNumber}: ${rpcErr.message}`);
          errors++;
          continue;
        }

        lineCount++;
      }
    }

    console.log(`  ✓ ${dateStr}: 10 receipts`);
  }

  console.log(`\nDone! Receipts: ${receiptCount}, Lines/Lots: ${lineCount}, Errors: ${errors}`);
}

main().catch(e => { console.error(e); process.exit(1); });
