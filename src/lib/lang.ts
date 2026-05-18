import { cookies } from 'next/headers';
import type { Lang } from './i18n';

export async function getLang(): Promise<Lang> {
  const store = await cookies();
  return store.get('lang')?.value === 'en' ? 'en' : 'ja';
}
