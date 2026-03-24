/**
 * Slack slash command → GitHub Issue converter
 *
 * Slackの設定:
 *   Slash Commands > /task > Request URL: https://<your-domain>/api/slack-issue
 *
 * 必要な環境変数:
 *   SLACK_SIGNING_SECRET   — Slack App の Signing Secret
 *   GITHUB_TOKEN           — repo スコープ付き Personal Access Token
 *   GITHUB_OWNER           — リポジトリオーナー名 (例: naoki3)
 *   GITHUB_REPO            — リポジトリ名 (例: claude-sports-betting)
 */

import { createHmac, timingSafeEqual } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';

function verifySlackSignature(req: NextRequest, rawBody: string): boolean {
  const signingSecret = process.env.SLACK_SIGNING_SECRET;
  if (!signingSecret) return false;

  const timestamp = req.headers.get('x-slack-request-timestamp') ?? '';
  const slackSig = req.headers.get('x-slack-signature') ?? '';

  // Replay attack prevention: reject requests older than 5 minutes
  if (Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) return false;

  const baseString = `v0:${timestamp}:${rawBody}`;
  const hmac = createHmac('sha256', signingSecret).update(baseString).digest('hex');
  const computed = `v0=${hmac}`;

  try {
    return timingSafeEqual(Buffer.from(computed), Buffer.from(slackSig));
  } catch {
    return false;
  }
}

async function createGitHubIssue(title: string, body: string): Promise<string> {
  const owner = process.env.GITHUB_OWNER;
  const repo = process.env.GITHUB_REPO;
  const token = process.env.GITHUB_TOKEN;

  if (!owner || !repo || !token) {
    throw new Error('GitHub env vars not set');
  }

  const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/issues`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      title,
      body,
      labels: ['claude'], // これで GitHub Actions が自動起動
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`GitHub API error: ${err}`);
  }

  const issue = await res.json();
  return issue.html_url as string;
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text();

  // Slack の署名検証
  if (!verifySlackSignature(req, rawBody)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // application/x-www-form-urlencoded をパース
  const params = new URLSearchParams(rawBody);
  const text = params.get('text')?.trim() ?? '';
  const userName = params.get('user_name') ?? 'unknown';

  if (!text) {
    return NextResponse.json({
      response_type: 'ephemeral',
      text: '使い方: `/task <やること>` — 例: `/task LPのCTA文言をA/Bテスト版に変えてstagingに出して`',
    });
  }

  // 1行目をタイトル、残りを本文に分割
  const lines = text.split('\n');
  const title = lines[0];
  const extra = lines.slice(1).join('\n').trim();

  const issueBody = [
    `## やること`,
    title,
    extra ? `\n${extra}` : '',
    `\n---`,
    `_Slackから @${userName} が送信_`,
  ]
    .filter(Boolean)
    .join('\n');

  try {
    const issueUrl = await createGitHubIssue(title, issueBody);
    return NextResponse.json({
      response_type: 'in_channel',
      text: `Issue を作成しました。Claude が実装を開始します :robot_face:\n${issueUrl}`,
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({
      response_type: 'ephemeral',
      text: `エラー: Issue の作成に失敗しました。管理者に連絡してください。`,
    });
  }
}
