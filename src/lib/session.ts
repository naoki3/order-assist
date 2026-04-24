import { cookies } from 'next/headers';
import { createHmac } from 'crypto';

const SECRET = process.env.SESSION_SECRET ?? 'dev-secret-change-in-production';
const COOKIE_NAME = 'session';

export interface SessionData {
  userId: string;
  username: string;
  isAdmin: boolean;
}

function sign(payload: string): string {
  return createHmac('sha256', SECRET).update(payload).digest('hex');
}

export function encodeSession(data: SessionData): string {
  const payload = Buffer.from(JSON.stringify(data)).toString('base64');
  const sig = sign(payload);
  return `${payload}.${sig}`;
}

export function decodeSession(token: string): SessionData | null {
  const dot = token.lastIndexOf('.');
  if (dot === -1) return null;
  const payload = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  if (sign(payload) !== sig) return null;
  try {
    return JSON.parse(Buffer.from(payload, 'base64').toString('utf8')) as SessionData;
  } catch {
    return null;
  }
}

export async function getSession(): Promise<SessionData | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return decodeSession(token);
}

export async function setSession(data: SessionData): Promise<void> {
  const jar = await cookies();
  jar.set(COOKIE_NAME, encodeSession(data), {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
  });
}

export async function clearSession(): Promise<void> {
  const jar = await cookies();
  jar.delete(COOKIE_NAME);
}
