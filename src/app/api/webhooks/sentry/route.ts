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
  id?: string;
  project?: string;
  culprit?: string;
  message?: string;
  level?: string;
  url?: string;
  triggering_rules?: string[];
  event?: SentryEvent;
}

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

  const summaryLines: string[] = [];
  summaryLines.push(`**本番環境でエラーが発生しました。** (An error occurred in production.)`);
  summaryLines.push('');
  if (exc) {
    summaryLines.push(`- **エラー:** \`${exc.type}: ${exc.value}\``);
  }
  if (issue.culprit) {
    summaryLines.push(`- **発生箇所 / Location:** \`${issue.culprit}\``);
  }
  summaryLines.push(`- **環境 / Environment:** ${env}`);
  summaryLines.push(`- **レベル / Level:** ${issue.level}`);
  if (rule) {
    summaryLines.push(`- **アラートルール / Alert Rule:** ${rule}`);
  }
  summaryLines.push('');
  summaryLines.push(`| 発生回数 / Count | 影響ユーザー / Users | 初回検知 / First Seen | 最終検知 / Last Seen |`);
  summaryLines.push(`|---|---|---|---|`);
  summaryLines.push(
    `| ${issue.count ?? '—'} | ${issue.userCount ?? '—'} ` +
    `| ${issue.firstSeen ? new Date(issue.firstSeen).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' }) : '—'} ` +
    `| ${issue.lastSeen ? new Date(issue.lastSeen).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' }) : '—'} |`
  );

  const stackLines = frames.map(f => {
    const loc = `${f.filename ?? '?'}:${f.lineno ?? '?'} in \`${f.function ?? '?'}\``;
    return f.context_line ? `  ${loc}\n    ${f.context_line.trim()}` : `  ${loc}`;
  });
  const stackSection = exc && stackLines.length > 0
    ? ['', '## スタックトレース / Stack Trace', '', '```', `${exc.type}: ${exc.value}`, '', stackLines.join('\n'), '```'].join('\n')
    : '';

  const sentryLink = issue.permalink
    ? `\n[🔗 Sentryで詳細を確認 / View in Sentry](${issue.permalink})\n`
    : '';

  return [
    `## 何が起きたか / What Happened`,
    '',
    summaryLines.join('\n'),
    sentryLink,
    stackSection,
    '',
    '---',
    `*Sentryアラートから自動作成 / Auto-generated from Sentry alert. ID: \`${issue.id}\`*`,
  ].join('\n');
}

async function ensureSentryLabel(owner: string, repo: string, token: string): Promise<void> {
  const headers = { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' };
  const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/labels/sentry`, { headers });
  if (res.status === 404) {
    await fetch(`https://api.github.com/repos/${owner}/${repo}/labels`, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'sentry', color: '362d59', description: 'Auto-filed from Sentry alert' }),
    });
  }
}

async function isDuplicate(owner: string, repo: string, issueId: string, token: string): Promise<boolean> {
  const q = encodeURIComponent(`repo:${owner}/${repo} "Sentry Issue ID: \`${issueId}\`" in:body is:issue`);
  const res = await fetch(`https://api.github.com/search/issues?q=${q}&per_page=1`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' },
  });
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
    env: { GITHUB_TOKEN: !!token, GITHUB_REPO_NAME: repo ?? null, GITHUB_REPO_OWNER: owner, SENTRY_WEBHOOK_SECRET: !!secret },
    github_api: githubStatus,
  });
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const signature = req.headers.get('sentry-hook-signature');
  const secret = process.env.SENTRY_WEBHOOK_SECRET;

  if (secret && signature && !verifySignature(rawBody, signature, secret)) {
    console.error('[sentry-webhook] signature mismatch');
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  let payload: SentryWebhookPayload;
  try { payload = JSON.parse(rawBody) as SentryWebhookPayload; } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const action = payload.action;
  const isTest = action === 'test';
  const isInternalIntegration = action !== undefined;

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
      issue = payload.data.issue;
    } else if (event?.id) {
      issue = { id: event.id, shortId: event.id, title: event.title ?? 'Sentry Error', culprit: event.culprit, level: event.level ?? 'error', status: 'unresolved' };
    } else {
      issue = { id: `alert-${Date.now()}`, shortId: 'TEST', title: 'Alert Test Notification', level: 'error', status: 'unresolved' };
    }
  } else {
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

  if (!token || !repo) {
    return NextResponse.json({ error: 'GitHub credentials not configured' }, { status: 500 });
  }

  if (await isDuplicate(owner, repo, issue.id, token)) {
    return NextResponse.json({ ok: true, skipped: 'duplicate' });
  }

  await ensureSentryLabel(owner, repo, token);

  const ghRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/issues`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: `[Sentry] ${issue.title}`,
      body: buildBody(issue, event, rule),
      labels: ['bug', 'sentry'],
    }),
  });

  if (!ghRes.ok) {
    const text = await ghRes.text();
    console.error('[sentry-webhook] GitHub API error', ghRes.status, text.slice(0, 300));
    return NextResponse.json({ error: 'Failed to create GitHub issue', status: ghRes.status, details: text.slice(0, 300) }, { status: 502 });
  }

  const ghIssue = await ghRes.json() as { number: number; html_url: string };
  console.log('[sentry-webhook] created issue #', ghIssue.number);
  return NextResponse.json({ ok: true, github_issue: ghIssue.html_url, number: ghIssue.number });
}
