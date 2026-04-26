/**
 * Vessel-size exposure summary helpers shared between the profile and
 * applicant-card render paths.
 *
 * Formats the union of a user's selected `vessel_size_bands` rows into a
 * single short label like "30-90m" or "90m+" (open-ended top tier).
 *
 * Defensive on input: rows with non-numeric `min_meters` are dropped
 * (e.g. when a stale browser cache holds a SizeBandLookup shape that
 * predates the column being added — see Fix 235 cache-invalidation).
 */

export interface SizeBandRange {
  min_meters: number;
  max_meters: number | null;
}

/**
 * Combined vessel-size exposure label across the supplied band IDs.
 *
 * Returns `null` when no exposure is set or no usable range can be
 * computed — caller should omit the segment when null.
 *
 * - Single band → `"50m"` (collapsed, not "50-50m")
 * - Multi-band → `"30-90m"` (lowest min to highest max)
 * - Any open-ended band (`max_meters` null) → `"<min>m+"`
 */
export function vesselSizeRange(
  exposureIds: string[] | null | undefined,
  ranges: Record<string, SizeBandRange> | undefined,
): string | null {
  if (!exposureIds?.length || !ranges) return null;
  const bands = exposureIds.map((id) => ranges[id]).filter(Boolean);
  const mins = bands.map((b) => b.min_meters).filter((m): m is number => typeof m === 'number');
  if (mins.length === 0) return null;
  const min = Math.min(...mins);
  const maxes = bands.map((b) => b.max_meters);
  if (maxes.some((m) => m === null)) return `${min}m+`;
  const validMaxes = maxes.filter((m): m is number => typeof m === 'number');
  if (validMaxes.length === 0) return null;
  const max = Math.max(...validMaxes);
  return min === max ? `${min}m` : `${min}-${max}m`;
}
