import { cookies } from 'next/headers';
import type { Lang } from './i18n';
import { DEFAULT_TZ } from './tz';

export async function getLang(): Promise<Lang> {
  const store = await cookies();
  return store.get('lang')?.value === 'en' ? 'en' : 'ja';
}

export async function getTz(): Promise<string> {
  const store = await cookies();
  return store.get('tz')?.value ?? DEFAULT_TZ;
}
