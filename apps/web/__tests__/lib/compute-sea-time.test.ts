import { describe, it, expect } from 'vitest';
import { computeSeaTime } from '@/lib/compute-sea-time';

describe('computeSeaTime', () => {
  it('returns "0d" for empty array', () => {
    expect(computeSeaTime([])).toBe('0d');
  });

  it('computes single experience spanning 6 months', () => {
    const result = computeSeaTime([
      { start_date: '2025-01-01', end_date: '2025-07-01', is_current: false },
    ]);
    expect(result).toBe('6m');
  });

  it('computes multiple non-overlapping entries', () => {
    const result = computeSeaTime([
      { start_date: '2025-01-01', end_date: '2025-04-01', is_current: false }, // 3 months
      { start_date: '2025-06-01', end_date: '2025-09-01', is_current: false }, // 3 months
    ]);
    expect(result).toBe('6m');
  });

  it('handles is_current with no end_date using today', () => {
    // Create a start date 2 months ago — result should be ~2m
    const twoMonthsAgo = new Date();
    twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2);
    const startDate = twoMonthsAgo.toISOString().split('T')[0];

    const result = computeSeaTime([
      { start_date: startDate, end_date: null, is_current: true },
    ]);
    expect(result).toBe('2m');
  });

  it('returns days for sub-month experience', () => {
    const result = computeSeaTime([
      { start_date: '2025-03-01', end_date: '2025-03-11', is_current: false }, // 10 days
    ]);
    expect(result).toBe('10d');
  });

  it('computes year+ experience correctly', () => {
    const result = computeSeaTime([
      { start_date: '2023-03-01', end_date: '2025-03-01', is_current: false },
    ]);
    expect(result).toBe('2y');
  });

  it('does not round up at 14 remaining days', () => {
    // 1 month + 14 days → should be "1m" (14 < 15, no round up)
    const result = computeSeaTime([
      { start_date: '2025-01-01', end_date: '2025-02-15', is_current: false },
    ]);
    expect(result).toBe('1m');
  });

  it('rounds up at 15 remaining days', () => {
    // 1 month + 15 days → should be "2m" (15 >= 15, rounds up)
    const result = computeSeaTime([
      { start_date: '2025-01-01', end_date: '2025-02-16', is_current: false },
    ]);
    expect(result).toBe('2m');
  });
});
