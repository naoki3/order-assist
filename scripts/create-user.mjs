/**
 * Create a user in the database.
 * Usage: node scripts/create-user.mjs <username> <password>
 * Example: node scripts/create-user.mjs admin mypassword
 */
import bcrypt from 'bcryptjs';
import { createClient } from '@supabase/supabase-js';

const [, , username, password] = process.argv;

if (!username || !password) {
  console.error('Usage: node scripts/create-user.mjs <username> <password>');
  process.exit(1);
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);
const passwordHash = bcrypt.hashSync(password, 10);

const { error } = await supabase
  .from('users')
  .insert({ username, password_hash: passwordHash, is_admin: true });

if (error) {
  console.error('Failed:', error.message);
  process.exit(1);
}

console.log(`Created user: ${username}`);
