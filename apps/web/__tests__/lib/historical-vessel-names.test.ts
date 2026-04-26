import { describe, it, expect, vi } from 'vitest';
import { resolveHistoricalVesselNames } from '@/lib/vessels/historical-names';

function mockSupabase(rows: unknown[]) {
  const order = vi.fn().mockResolvedValue({ data: rows, error: null });
  const inFn = vi.fn().mockReturnValue({ order });
  const select = vi.fn().mockReturnValue({ in: inFn });
  const from = vi.fn().mockReturnValue({ select });
  return { from } as unknown as Parameters<typeof resolveHistoricalVesselNames>[0];
}

describe('resolveHistoricalVesselNames', () => {
  it('returns empty map when no pairs given', async () => {
    const sb = mockSupabase([]);
    const result = await resolveHistoricalVesselNames(sb, []);
    expect(result.size).toBe(0);
  });

  it('returns historical name covering experience start date', async () => {
    const sb = mockSupabase([
      // Two history rows for vessel-a: was "Sea Wolf" until 2020-12-31,
      // is "Black Pearl" from 2021-01-01 onward.
      {
        vessel_id: 'vessel-a',
        name: 'Black Pearl',
        effective_from: '2021-01-01',
        effective_to: null,
      },
      {
        vessel_id: 'vessel-a',
        name: 'Sea Wolf',
        effective_from: '2018-01-01',
        effective_to: '2020-12-31',
      },
    ]);
    const result = await resolveHistoricalVesselNames(sb, [
      { vessel_id: 'vessel-a', start_date: '2019-06-15' },
    ]);
    expect(result.get('vessel-a|2019-06-15')).toBe('Sea Wolf');
  });

  it('returns the still-current name when start_date falls in open-ended row', async () => {
    const sb = mockSupabase([
      {
        vessel_id: 'vessel-a',
        name: 'Black Pearl',
        effective_from: '2021-01-01',
        effective_to: null,
      },
    ]);
    const result = await resolveHistoricalVesselNames(sb, [
      { vessel_id: 'vessel-a', start_date: '2024-08-01' },
    ]);
    expect(result.get('vessel-a|2024-08-01')).toBe('Black Pearl');
  });

  it('returns no entry when experience predates the earliest known name', async () => {
    const sb = mockSupabase([
      {
        vessel_id: 'vessel-a',
        name: 'Sea Wolf',
        effective_from: '2018-01-01',
        effective_to: null,
      },
    ]);
    const result = await resolveHistoricalVesselNames(sb, [
      { vessel_id: 'vessel-a', start_date: '2010-06-15' },
    ]);
    // Caller will fall back to denormalised vessels.name.
    expect(result.has('vessel-a|2010-06-15')).toBe(false);
  });

  it('handles many pairs across multiple vessels in one DB roundtrip', async () => {
    const sb = mockSupabase([
      {
        vessel_id: 'vessel-a',
        name: 'Black Pearl',
        effective_from: '2021-01-01',
        effective_to: null,
      },
      {
        vessel_id: 'vessel-a',
        name: 'Sea Wolf',
        effective_from: '2018-01-01',
        effective_to: '2020-12-31',
      },
      {
        vessel_id: 'vessel-b',
        name: 'Aurora',
        effective_from: '2015-06-01',
        effective_to: null,
      },
    ]);
    const result = await resolveHistoricalVesselNames(sb, [
      { vessel_id: 'vessel-a', start_date: '2019-06-15' },
      { vessel_id: 'vessel-a', start_date: '2022-06-15' },
      { vessel_id: 'vessel-b', start_date: '2019-06-15' },
    ]);
    expect(result.get('vessel-a|2019-06-15')).toBe('Sea Wolf');
    expect(result.get('vessel-a|2022-06-15')).toBe('Black Pearl');
    expect(result.get('vessel-b|2019-06-15')).toBe('Aurora');
  });

  it('treats same-day rename (zero-length closed interval) correctly', async () => {
    // Same-day rename creates a zero-length interval ending on
    // effective_from. Lookup at that exact date should still find
    // the row.
    const sb = mockSupabase([
      {
        vessel_id: 'vessel-a',
        name: 'New Name',
        effective_from: '2024-06-15',
        effective_to: null,
      },
      {
        vessel_id: 'vessel-a',
        name: 'Old Name',
        effective_from: '2024-06-15',
        effective_to: '2024-06-15',
      },
    ]);
    const result = await resolveHistoricalVesselNames(sb, [
      { vessel_id: 'vessel-a', start_date: '2024-06-15' },
    ]);
    // The DB returned the new-name row first (effective_from desc), so
    // .find() picks it. Either answer is acceptable on a zero-length
    // boundary — what matters is no crash + a deterministic result.
    expect(result.get('vessel-a|2024-06-15')).toBe('New Name');
  });
});
