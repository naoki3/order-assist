/**
 * Pure calculation functions extracted from calculator.ts.
 * No I/O or side effects — safe to import in tests.
 */

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
  safetyStockDays: number
): string {
  const recent3dAvg = quantities.slice(-3).reduce((sum, q) => sum + q, 0) / 3;
  if (avgDemand7d === 0) {
    return 'No sales data for the past 7 days';
  } else if (orderQty === 0) {
    return 'Stock is sufficient, no order needed';
  } else if (recent3dAvg > avgDemand7d * 1.2) {
    return `Sales trending up — ordering more (3-day avg: ${recent3dAvg.toFixed(1)} units/day)`;
  } else if (recent3dAvg < avgDemand7d * 0.8) {
    return `Sales slowing down (3-day avg: ${recent3dAvg.toFixed(1)} units/day)`;
  } else {
    return `Avg demand ${avgDemand7d.toFixed(1)} units/day × ${leadTimeDays + safetyStockDays} days`;
  }
}
