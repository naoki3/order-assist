/**
 * Delete every auth user EXCEPT the demo account.
 *
 * This is destructive and irreversible. It deletes users from Supabase Auth
 * (auth.users) via the Admin API; rows in app tables that reference the user
 * are removed by their ON DELETE CASCADE foreign keys.
 *
 * Usage:
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
 *     node scripts/delete-non-demo-users.mjs <demo-email> [--yes]
 *
 * By default it runs in DRY-RUN mode and only prints what it would do.
 * Pass --yes (or set CONFIRM=yes) to actually delete.
 *
 * You can keep more than one account by passing several emails:
 *   node scripts/delete-non-demo-users.mjs demo@x.com owner@x.com --yes
 */
import { createClient } from '@supabase/supabase-js';

const args = process.argv.slice(2);
const apply = args.includes('--yes') || process.env.CONFIRM === 'yes';
const keepEmails = args
  .filter((a) => !a.startsWith('--'))
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

if (keepEmails.length === 0) {
  console.error('Usage: node scripts/delete-non-demo-users.mjs <demo-email> [more-emails...] [--yes]');
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

// Collect all users (listUsers is paginated; default 50 per page).
const allUsers = [];
for (let page = 1; ; page++) {
  const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
  if (error) { console.error('Failed to list users:', error.message); process.exit(1); }
  if (!data.users.length) break;
  allUsers.push(...data.users);
  if (data.users.length < 200) break;
}

const keep = allUsers.filter((u) => keepEmails.includes((u.email ?? '').toLowerCase()));
const toDelete = allUsers.filter((u) => !keepEmails.includes((u.email ?? '').toLowerCase()));

// Safety: make sure every requested keep-email actually exists.
const foundEmails = new Set(keep.map((u) => (u.email ?? '').toLowerCase()));
const missing = keepEmails.filter((e) => !foundEmails.has(e));
if (missing.length) {
  console.error(`ABORT: keep-email(s) not found, refusing to continue: ${missing.join(', ')}`);
  process.exit(1);
}

console.log(`Total users: ${allUsers.length}`);
console.log(`Keeping (${keep.length}): ${keep.map((u) => u.email).join(', ')}`);
console.log(`Deleting (${toDelete.length}):`);
for (const u of toDelete) console.log(`  - ${u.email ?? '(no email)'} (${u.id})`);

if (!apply) {
  console.log('\nDRY RUN — nothing deleted. Re-run with --yes to apply.');
  process.exit(0);
}

let ok = 0;
let failed = 0;
for (const u of toDelete) {
  const { error } = await supabase.auth.admin.deleteUser(u.id);
  if (error) { console.error(`  FAILED ${u.email}: ${error.message}`); failed++; }
  else { ok++; }
}

console.log(`\nDeleted ${ok} user(s), ${failed} failure(s).`);
process.exit(failed ? 1 : 0);
