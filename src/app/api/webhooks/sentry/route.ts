import { NextRequest, NextResponse } from 'next/server';
import { createHmac, timingSafeEqual } from 'crypto';

interface SentryIssue {
  id: string;
  shortId?: string;
  title: string;
  culprit?: string;
  level: string;
  status: string;
  count?: string;
  userCount?: number;
  firstSeen?: string;
  lastSeen?: string;
  permalink?: string;
  project?: { id: string; name: string; slug: string };
}

interface SentryEvent {
  id?: string;
  title?: string;
  culprit?: string;
  level?: string;
  environment?: string;
  tags?: [string, string][];
  exception?: {
    values?: Array<{
      type: string;
      value: string;
      stacktrace?: { frames?: Array<{ filename?: string; lineno?: number; function?: string; context_line?: string }> };
    }>;
  };
}

interface SentryWebhookPayload {
  action?: string;
  data?: {
    issue?: SentryIssue;
    event?: SentryEvent;
    triggered_rule?: string;
  };
  triggered_rule?: string;
  // Webhooks plugin flat format
  id?: string;
  project?: string;
  project_name?: string;
  culprit?: string;
  message?: string;
  level?: string;
  url?: string;
  triggering_rules?: string[];
  event?: SentryEvent;
}

// Actions that mean the issue was resolved/changed — not worth filing a new GitHub issue
const SKIP_ACTIONS = new Set(['resolved', 'assigned', 'ignored', 'archived', 'unresolved']);

function verifySignature(body: string, rawSig: string, secret: string): boolean {
  try {
    const sig = rawSig.replace(/^sha256=/, '');
    const expected = createHmac('sha256', secret).update(body).digest('hex');
    if (sig.length !== expected.length) return false;
    return timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
  } catch { return false; }
}

function getTag(tags: [string, string][] | undefined, key: string): string | null {
  return tags?.find(([k]) => k === key)?.[1] ?? null;
}

function buildBody(issue: SentryIssue, event: SentryEvent | undefined, rule: string | undefined): string {
  const env = getTag(event?.tags, 'environment') ?? event?.environment ?? 'production';
  const exc = event?.exception?.values?.[0];
  const frames = exc?.stacktrace?.frames?.slice(-5).reverse() ?? [];
  const rows: [string, string][] = [
    ['Environment', env], ['Level', issue.level], ['Status', issue.status],
    ['Event Count', issue.count ?? '—'], ['Affected Users', String(issue.userCount ?? '—')],
    ['First Seen', issue.firstSeen ? new Date(issue.firstSeen).toISOString() : '—'],
    ['Last Seen', issue.lastSeen ? new Date(issue.lastSeen).toISOString() : '—'],
    ...(issue.culprit ? [['Culprit', `\`${issue.culprit}\``] as [string, string]] : []),
    ...(rule ? [['Alert Rule', rule] as [string, string]] : []),
  ];
  const table = ['| Field | Value |', '|-------|-------|', ...rows.map(([k, v]) => `| **${k}** | ${v} |`)].join('\n');
  const stackLines = frames.map(f => { const loc = `${f.filename ?? '?'}:${f.lineno ?? '?'} in \`${f.function ?? '?'}\``; return f.context_line ? `  ${loc}\n    ${f.context_line.trim()}` : `  ${loc}`; });
  const stackSection = exc && stackLines.length > 0 ? ['', '## Stack Trace', '', '```', `${exc.type}: ${exc.value}`, '', stackLines.join('\n'), '```'].join('\n') : '';
  return [`## Sentry Issue: ${issue.shortId ?? issue.id}`, '', table, '', ...(issue.permalink ? [`**Sentry Link:** ${issue.permalink}`, ''] : []), stackSection, '', '---', `*Auto-generated from Sentry alert. Sentry Issue ID: \`${issue.id}\`*`].join('\n');
}

async function ensureSentryLabel(owner: string, repo: string, token: string): Promise<void> {
  const headers = { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' };
  const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/labels/sentry`, { headers });
  if (res.status === 404) { await fetch(`https://api.github.com/repos/${owner}/${repo}/labels`, { method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'sentry', color: '362d59', description: 'Auto-filed from Sentry alert' }) }); }
}

async function isDuplicate(owner: string, repo: string, issueId: string, token: string): Promise<boolean> {
  const q = encodeURIComponent(`repo:${owner}/${repo} "Sentry Issue ID: \`${issueId}\`" in:body is:issue`);
  const res = await fetch(`https://api.github.com/search/issues?q=${q}&per_page=1`, { headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' } });
  if (!res.ok) return false;
  const data = await res.json() as { total_count: number };
  return data.total_count > 0;
}

export async function GET() {
  const token = process.env.GITHUB_TOKEN;
  const repo = process.env.GITHUB_REPO_NAME;
  const owner = process.env.GITHUB_REPO_OWNER ?? 'naoki3';
  const secret = process.env.SENTRY_WEBHOOK_SECRET;

  let githubStatus = 'not checked';
  if (token && repo) {
    try {
      const res = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' },
      });
      githubStatus = res.ok ? 'ok' : `error ${res.status}: ${(await res.text()).slice(0, 100)}`;
    } catch (e) {
      githubStatus = `fetch error: ${String(e)}`;
    }
  }

  return NextResponse.json({
    env: {
      GITHUB_TOKEN: !!token,
      GITHUB_REPO_NAME: repo ?? null,
      GITHUB_REPO_OWNER: owner,
      SENTRY_WEBHOOK_SECRET: !!secret,
    },
    github_api: githubStatus,
  });
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const signature = req.headers.get('sentry-hook-signature');
  const resource = req.headers.get('sentry-hook-resource');
  const secret = process.env.SENTRY_WEBHOOK_SECRET;

  console.log('[sw] resource:', resource, 'sig:', !!signature);
  console.log('[sw] body:', rawBody.slice(0, 1000));

  if (secret && signature && !verifySignature(rawBody, signature, secret)) {
    console.error('[sw] signature mismatch — proceeding for debug');
  }

  let payload: SentryWebhookPayload;
  try { payload = JSON.parse(rawBody) as SentryWebhookPayload; } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const action = payload.action;
  const isTest = action === 'test';
  const isInternalIntegration = action !== undefined;

  console.log('[sw] action:', action, 'data keys:', Object.keys(payload.data ?? {}).join(','));

  // Skip lifecycle state changes
  if (isInternalIntegration && SKIP_ACTIONS.has(action ?? '')) {
    return NextResponse.json({ ok: true, skipped: `action=${action}` });
  }

  let issue: SentryIssue | undefined;
  let event: SentryEvent | undefined;
  let rule: string | undefined;

  if (isInternalIntegration) {
    event = payload.data?.event;
    rule = payload.data?.triggered_rule ?? payload.triggered_rule;

    if (payload.data?.issue) {
      // issue resource: has full issue object
      issue = payload.data.issue;
    } else if (event?.id) {
      // event_alert resource: build issue from event data
      issue = {
        id: event.id,
        shortId: event.id,
        title: event.title ?? 'Sentry Error',
        culprit: event.culprit,
        level: event.level ?? 'error',
        status: 'unresolved',
      };
    } else if (isTest) {
      // test notification with no real data
      issue = { id: `test-${Date.now()}`, shortId: 'TEST-1', title: '[Test] Sentry Webhook Test', level: 'error', status: 'unresolved' };
    }
  } else {
    // Webhooks plugin flat format
    if (!payload.id && !payload.message) {
      return NextResponse.json({ ok: true, skipped: 'no issue data' });
    }
    issue = {
      id: payload.id ?? `webhook-${Date.now()}`,
      shortId: payload.id,
      title: payload.message ?? 'Sentry Issue',
      culprit: payload.culprit,
      level: payload.level ?? 'error',
      status: 'unresolved',
      permalink: payload.url,
    };
    event = payload.event;
    rule = payload.triggering_rules?.[0];
  }

  console.log('[sw] issue id:', issue?.id, 'title:', issue?.title?.slice(0, 80));

  if (!issue?.id) {
    return NextResponse.json({ ok: true, skipped: 'no issue data' });
  }

  if (!isTest) {
    const env = getTag(event?.tags, 'environment') ?? event?.environment;
    if (env && env !== 'production') {
      return NextResponse.json({ ok: true, skipped: `env=${env}` });
    }
  }

  const token = process.env.GITHUB_TOKEN;
  const owner = process.env.GITHUB_REPO_OWNER ?? 'naoki3';
  const repo = process.env.GITHUB_REPO_NAME;

  console.log('[sw] token:', !!token, 'repo:', `${owner}/${repo}`);

  if (!token || !repo) {
    return NextResponse.json({ error: 'GitHub credentials not configured' }, { status: 500 });
  }

  if (await isDuplicate(owner, repo, issue.id, token)) {
    console.log('[sw] duplicate:', issue.id);
    return NextResponse.json({ ok: true, skipped: 'duplicate' });
  }

  await ensureSentryLabel(owner, repo, token);

  const ghRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/issues`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: `[Sentry] ${issue.title}`, body: buildBody(issue, event, rule), labels: ['bug', 'sentry'] }),
  });

  if (!ghRes.ok) {
    const text = await ghRes.text();
    console.error('[sw] GitHub error', ghRes.status, text.slice(0, 300));
    return NextResponse.json({ error: 'Failed to create GitHub issue', status: ghRes.status, details: text.slice(0, 300) }, { status: 502 });
  }

  const ghIssue = await ghRes.json() as { number: number; html_url: string };
  console.log('[sw] created #', ghIssue.number, ghIssue.html_url);
  return NextResponse.json({ ok: true, github_issue: ghIssue.html_url, number: ghIssue.number });
}
