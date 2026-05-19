export const SUPPORTED_TZ = [
  { value: 'Asia/Tokyo', label: '日本 (JST, UTC+9)' },
  { value: 'Asia/Seoul', label: '韓国 (KST, UTC+9)' },
  { value: 'Asia/Shanghai', label: '中国 (CST, UTC+8)' },
  { value: 'Asia/Singapore', label: 'シンガポール (SGT, UTC+8)' },
  { value: 'UTC', label: 'UTC' },
  { value: 'Europe/London', label: 'ロンドン (GMT/BST)' },
  { value: 'America/New_York', label: '米東部 (ET)' },
  { value: 'America/Los_Angeles', label: '米西部 (PT)' },
] as const;

export const DEFAULT_TZ = 'Asia/Tokyo';

// Returns YYYY-MM-DD in the given timezone
export function toLocalDateStr(tz: string, date: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}
