/**
 * Geographic distance helpers. Pure functions, no platform deps —
 * usable from API routes, edge functions, and scripts.
 *
 * The "available crew" tab on the daywork review page uses this to
 * sort Pro crew by proximity to the daywork's port. Distances are
 * computed in JavaScript at request time over the small candidate
 * set returned by the city/region filter; no PostGIS required.
 */

const EARTH_RADIUS_KM = 6371;

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/**
 * Great-circle distance between two lat/lng points in kilometres.
 * Uses the haversine formula. Returns Infinity if any input is
 * non-finite (caller can rely on this to push unknowns to the end of
 * a sort).
 */
export function haversineKm(
  lat1: number | null | undefined,
  lon1: number | null | undefined,
  lat2: number | null | undefined,
  lon2: number | null | undefined,
): number {
  if (
    !Number.isFinite(lat1 as number) ||
    !Number.isFinite(lon1 as number) ||
    !Number.isFinite(lat2 as number) ||
    !Number.isFinite(lon2 as number)
  ) {
    return Number.POSITIVE_INFINITY;
  }
  const phi1 = toRad(lat1 as number);
  const phi2 = toRad(lat2 as number);
  const dPhi = toRad((lat2 as number) - (lat1 as number));
  const dLambda = toRad((lon2 as number) - (lon1 as number));
  const a =
    Math.sin(dPhi / 2) * Math.sin(dPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(dLambda / 2) * Math.sin(dLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_KM * c;
}

/**
 * Naive centroid of a set of lat/lng points — average of each axis.
 * Good enough as a representative anchor for distance sort over a
 * tightly-clustered city's ports; not a true geographic centroid for
 * non-convex distributions but the relative ordering it produces is
 * stable for the purpose. Returns null when no input has finite
 * coords.
 */
export function pointsCentroid(
  points: Array<{ latitude: number | null; longitude: number | null }>,
): { latitude: number; longitude: number } | null {
  let sumLat = 0;
  let sumLon = 0;
  let n = 0;
  for (const p of points) {
    if (Number.isFinite(p.latitude as number) && Number.isFinite(p.longitude as number)) {
      sumLat += p.latitude as number;
      sumLon += p.longitude as number;
      n += 1;
    }
  }
  if (n === 0) return null;
  return { latitude: sumLat / n, longitude: sumLon / n };
}
