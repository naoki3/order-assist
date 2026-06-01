import type { Lang } from './i18n';
import { translations } from './i18n';

export function buildDateRange(today: Date, days = 7): string[] {
  const dates: string[] = [];
  for (let i = days; i >= 1; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    dates.push(d.toISOString().split('T')[0]);
  }
  return dates;
}

export function calcAverageDemand(quantities: number[]): number {
  if (quantities.length === 0) return 0;
  return quantities.reduce((sum, q) => sum + q, 0) / quantities.length;
}

export function calcRequiredStock(
  avgDemand: number,
  leadTimeDays: number,
  safetyStockDays: number
): number {
  return Math.ceil(avgDemand * (leadTimeDays + safetyStockDays));
}

export function calcOrderQty(requiredStock: number, currentStock: number): number {
  return Math.max(0, requiredStock - currentStock);
}

export function buildReason(
  avgDemand7d: number,
  orderQty: number,
  quantities: number[],
  leadTimeDays: number,
  safetyStockDays: number,
  lang: Lang = 'ja'
): string {
  const dict = translations[lang];
  const recent3dAvg = quantities.slice(-3).reduce((sum, q) => sum + q, 0) / 3;
  const avg = recent3dAvg.toFixed(1);
  const avgAll = avgDemand7d.toFixed(1);
  const days = leadTimeDays + safetyStockDays;

  if (avgDemand7d === 0) {
    return dict['order.reasonNoData'] as string;
  } else if (orderQty === 0) {
    return dict['order.reasonSufficient'] as string;
  } else if (recent3dAvg > avgDemand7d * 1.2) {
    return (dict['order.reasonTrendUp'] as (a: string) => string)(avg);
  } else if (recent3dAvg < avgDemand7d * 0.8) {
    return (dict['order.reasonTrendDown'] as (a: string) => string)(avg);
  } else {
    return (dict['order.reasonNormal'] as (a: string, d: number) => string)(avgAll, days);
  }
}
