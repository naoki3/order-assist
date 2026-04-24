/**
 * Create a user via Supabase Auth Admin API.
 * Usage: node scripts/create-user.mjs <email> <password>
 * Example: SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/create-user.mjs admin@example.com mypassword
 */
import { createClient } from '@supabase/supabase-js';

const [, , email, password] = process.argv;

if (!email || !password) {
  console.error('Usage: node scripts/create-user.mjs <email> <password>');
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

const { data, error } = await supabase.auth.admin.createUser({
  email,
  password,
  email_confirm: true,
});

if (error) {
  console.error('Failed:', error.message);
  process.exit(1);
}

console.log(`Created user: ${data.user.email} (id: ${data.user.id})`);
