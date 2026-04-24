/**
 * Seed demo data for a specific user.
 * Usage: SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/seed-demo.mjs <email>
 */
import { createClient } from '@supabase/supabase-js';

const [, , email] = process.argv;

if (!email) {
  console.error('Usage: node scripts/seed-demo.mjs <email>');
  process.exit(1);
}

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// Resolve user ID from email
const { data: { users }, error: listError } = await supabase.auth.admin.listUsers();
if (listError) { console.error('Failed to list users:', listError.message); process.exit(1); }
const user = users.find((u) => u.email === email);
if (!user) { console.error(`User not found: ${email}`); process.exit(1); }
const userId = user.id;

console.log(`Seeding demo data for ${email} (${userId})...`);

const products = [
  { name: 'Milk 1L',        lead_time_days: 2, safety_stock_days: 1, stock: 8,  dailySales: [12, 10, 11, 13, 12, 11, 10] },
  { name: 'Bread',          lead_time_days: 1, safety_stock_days: 1, stock: 5,  dailySales: [8,  7,  9,  8,  7,  8,  9]  },
  { name: 'Eggs (10 pack)', lead_time_days: 3, safety_stock_days: 2, stock: 12, dailySales: [5,  6,  5,  7,  6,  5,  6]  },
  { name: 'Yogurt',         lead_time_days: 2, safety_stock_days: 1, stock: 4,  dailySales: [4,  3,  4,  5,  4,  3,  4]  },
  { name: 'Orange Juice',   lead_time_days: 2, safety_stock_days: 1, stock: 6,  dailySales: [3,  4,  3,  4,  3,  3,  4]  },
];

const today = new Date();
const dates = Array.from({ length: 7 }, (_, i) => {
  const d = new Date(today);
  d.setDate(today.getDate() - (7 - i));
  return d.toISOString().split('T')[0];
});

for (const p of products) {
  const { data: product, error: prodError } = await supabase
    .from('products')
    .insert({ name: p.name, lead_time_days: p.lead_time_days, safety_stock_days: p.safety_stock_days, user_id: userId })
    .select('id')
    .single();

  if (prodError) { console.error(`Failed to insert product ${p.name}:`, prodError.message); continue; }

  await supabase.from('inventory').upsert({
    product_id: product.id,
    current_stock: p.stock,
    updated_at: today.toISOString().split('T')[0],
  });

  const salesRows = dates.map((date, i) => ({
    product_id: product.id,
    date,
    quantity: p.dailySales[i],
    user_id: userId,
  }));
  await supabase.from('sales').upsert(salesRows, { onConflict: 'product_id,date' });

  console.log(`  Seeded: ${p.name}`);
}

console.log('Done.');
