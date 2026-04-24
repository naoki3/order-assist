import { describe, it, expect } from 'vitest';
import {
  buildDateRange,
  calcAverageDemand,
  calcRequiredStock,
  calcOrderQty,
  buildReason,
} from './calculator-logic';

describe('buildDateRange', () => {
  const today = new Date('2026-04-24');

  it('returns exactly 7 dates', () => {
    expect(buildDateRange(today)).toHaveLength(7);
  });

  it('starts 7 days before today and ends 1 day before today', () => {
    const dates = buildDateRange(today);
    expect(dates[0]).toBe('2026-04-17');
    expect(dates[6]).toBe('2026-04-23');
  });

  it('does not include today itself', () => {
    expect(buildDateRange(today)).not.toContain('2026-04-24');
  });

  it('respects a custom day count', () => {
    const dates = buildDateRange(today, 3);
    expect(dates).toHaveLength(3);
    expect(dates[0]).toBe('2026-04-21');
    expect(dates[2]).toBe('2026-04-23');
  });

  it('handles month boundaries correctly', () => {
    const boundary = new Date('2026-03-02');
    const dates = buildDateRange(boundary, 3);
    expect(dates).toEqual(['2026-02-27', '2026-02-28', '2026-03-01']);
  });
});

describe('calcAverageDemand', () => {
  it('computes the arithmetic mean', () => {
    expect(calcAverageDemand([0, 0, 0, 10, 10, 10, 40])).toBeCloseTo(10);
  });

  it('returns 0 for all-zero input', () => {
    expect(calcAverageDemand([0, 0, 0, 0, 0, 0, 0])).toBe(0);
  });

  it('returns 0 for an empty array', () => {
    expect(calcAverageDemand([])).toBe(0);
  });

  it('handles a single element', () => {
    expect(calcAverageDemand([42])).toBe(42);
  });
});

describe('calcRequiredStock', () => {
  it('rounds fractional demand up', () => {
    // ceil(1.5 * (3 + 2)) = ceil(7.5) = 8
    expect(calcRequiredStock(1.5, 3, 2)).toBe(8);
  });

  it('returns 0 when avgDemand is 0', () => {
    expect(calcRequiredStock(0, 5, 3)).toBe(0);
  });

  it('returns exact integer when demand is whole', () => {
    expect(calcRequiredStock(2, 3, 2)).toBe(10);
  });
});

describe('calcOrderQty', () => {
  it('returns the shortfall when stock is insufficient', () => {
    expect(calcOrderQty(10, 3)).toBe(7);
  });

  it('returns 0 when stock exactly meets the requirement', () => {
    expect(calcOrderQty(10, 10)).toBe(0);
  });

  it('returns 0 when stock exceeds the requirement', () => {
    expect(calcOrderQty(10, 15)).toBe(0);
  });
});

describe('buildReason', () => {
  it('reports no data when avgDemand is 0', () => {
    expect(buildReason(0, 0, [0, 0, 0, 0, 0, 0, 0], 3, 2)).toBe(
      'No sales data for the past 7 days'
    );
  });

  it('reports sufficient stock when orderQty is 0', () => {
    expect(buildReason(5, 0, [5, 5, 5, 5, 5, 5, 5], 3, 2)).toBe(
      'Stock is sufficient, no order needed'
    );
  });

  it('detects an upward trend', () => {
    // 7d avg ≈ 6.4, recent 3d avg = (5+15+25)/3 = 15 → > 1.2x
    const qty = [0, 0, 0, 5, 5, 15, 25];
    expect(buildReason(50 / 7, 5, qty, 3, 2)).toMatch(/trending up/);
  });

  it('detects a downward trend', () => {
    // 7d avg ≈ 6.1, recent 3d avg = (1+1+1)/3 = 1 → < 0.8x
    const qty = [10, 10, 10, 10, 1, 1, 1];
    expect(buildReason(43 / 7, 5, qty, 3, 2)).toMatch(/slowing/);
  });

  it('shows normal demand formula when neither trend applies', () => {
    const qty = [5, 5, 5, 5, 5, 5, 5];
    const reason = buildReason(5, 10, qty, 3, 2);
    expect(reason).toBe('Avg demand 5.0 units/day × 5 days');
  });
});
