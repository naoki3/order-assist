import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const SQL = `
ALTER TABLE incoming_stock ALTER COLUMN order_history_id DROP NOT NULL;

CREATE TABLE IF NOT EXISTS outgoing_stock (
  id BIGSERIAL PRIMARY KEY,
  product_id BIGINT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  product_name TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  scheduled_date DATE NOT NULL,
  note TEXT,
  shipped_at TIMESTAMPTZ
);

ALTER TABLE outgoing_stock DISABLE ROW LEVEL SECURITY;
`;

async function runMigration() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json({ error: 'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY' }, { status: 500 });
  }

  // Extract project ref from URL (e.g. https://abcdef.supabase.co -> abcdef)
  const projectRef = supabaseUrl.replace('https://', '').split('.')[0];

  // Try Supabase Management API
  const mgmtRes = await fetch(
    `https://api.supabase.com/v1/projects/${projectRef}/database/query`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${serviceRoleKey}`,
      },
      body: JSON.stringify({ query: SQL }),
    }
  );

  const mgmtText = await mgmtRes.text();

  if (mgmtRes.ok) {
    return NextResponse.json({ success: true, method: 'management-api', result: mgmtText });
  }

  // Fallback: try via PostgREST rpc exec_sql
  const rpcRes = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': serviceRoleKey,
      'Authorization': `Bearer ${serviceRoleKey}`,
    },
    body: JSON.stringify({ sql: SQL }),
  });

  const rpcText = await rpcRes.text();

  if (rpcRes.ok) {
    return NextResponse.json({ success: true, method: 'rpc', result: rpcText });
  }

  return NextResponse.json({
    error: 'Both methods failed',
    managementApi: { status: mgmtRes.status, body: mgmtText },
    rpc: { status: rpcRes.status, body: rpcText },
  }, { status: 500 });
}

export async function GET() {
  return runMigration();
}

export async function POST() {
  return runMigration();
}
