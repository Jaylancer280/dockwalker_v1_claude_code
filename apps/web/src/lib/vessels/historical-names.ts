import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Resolve "the name a vessel had on the date this experience started"
 * from the `vessel_names` timeline table. Surfaces the historical name
 * on profile experience cards so a 2018-2020 stint on IMO 1010545 shows
 * "MY Sea Wolf" even if the hull is now "MY Black Pearl".
 *
 * Rule: pick the row whose `[effective_from, effective_to]` interval
 * contains the experience's `start_date`. If no row matches (e.g. the
 * experience pre-dates the earliest known name on file) the helper
 * returns null for that key — caller falls back to denormalised
 * `vessels.name`.
 *
 * Returns a Map keyed `${vessel_id}|${start_date}`. Caller uses the
 * same key shape when reading.
 */
export async function resolveHistoricalVesselNames(
  supabase: SupabaseClient,
  pairs: Array<{ vessel_id: string; start_date: string }>,
): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  if (pairs.length === 0) return result;

  const vesselIds = [...new Set(pairs.map((p) => p.vessel_id))];
  const { data: rows } = await supabase
    .from('vessel_names')
    .select('vessel_id, name, effective_from, effective_to')
    .in('vessel_id', vesselIds)
    .order('effective_from', { ascending: false });

  if (!rows) return result;

  const byVessel = new Map<
    string,
    Array<{ name: string; effective_from: string; effective_to: string | null }>
  >();
  for (const r of rows as Array<{
    vessel_id: string;
    name: string;
    effective_from: string;
    effective_to: string | null;
  }>) {
    const arr = byVessel.get(r.vessel_id) ?? [];
    arr.push({ name: r.name, effective_from: r.effective_from, effective_to: r.effective_to });
    byVessel.set(r.vessel_id, arr);
  }

  for (const { vessel_id, start_date } of pairs) {
    const candidates = byVessel.get(vessel_id);
    if (!candidates) continue;
    const match = candidates.find(
      (c) =>
        c.effective_from <= start_date && (c.effective_to === null || c.effective_to >= start_date),
    );
    if (match) {
      result.set(`${vessel_id}|${start_date}`, match.name);
    }
  }

  return result;
}
