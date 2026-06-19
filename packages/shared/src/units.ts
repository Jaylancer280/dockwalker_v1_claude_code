// ── Currency ──

export type CurrencyCode = 'EUR' | 'USD' | 'GBP' | 'AED';

export const CURRENCY_SYMBOLS: Record<CurrencyCode, string> = {
  EUR: '\u20AC',
  USD: '$',
  GBP: '\u00A3',
  AED: '\u062F.\u0625',
};

export function currencySymbol(code: string): string {
  return CURRENCY_SYMBOLS[code as CurrencyCode] ?? '\u20AC';
}

export function formatRate(amount: number, code: string): string {
  return `${currencySymbol(code)}${amount}/day`;
}

// ── Distance units ──

export type DistanceUnit = 'km' | 'mi' | 'nm';

const KM_PER_NM = 1.852;
const KM_PER_MI = 1.60934;

/** Convert a distance from one unit to another. */
export function convertDistance(value: number, from: DistanceUnit, to: DistanceUnit): number {
  if (from === to) return value;
  // Normalize to km first
  let km: number;
  switch (from) {
    case 'km':
      km = value;
      break;
    case 'mi':
      km = value * KM_PER_MI;
      break;
    case 'nm':
      km = value * KM_PER_NM;
      break;
  }
  // Convert from km to target
  switch (to) {
    case 'km':
      return km;
    case 'mi':
      return km / KM_PER_MI;
    case 'nm':
      return km / KM_PER_NM;
  }
}

export function distanceLabel(unit: DistanceUnit): string {
  switch (unit) {
    case 'km':
      return 'km';
    case 'mi':
      return 'mi';
    case 'nm':
      return 'NM';
  }
}

export function formatDistance(value: number, unit: DistanceUnit, decimals = 1): string {
  return `${value.toFixed(decimals)} ${distanceLabel(unit)}`;
}

// ── Length (vessel sizes): meters ↔ feet ──

const FT_PER_M = 3.28084;

export type LengthUnit = 'm' | 'ft';

export function metersToFeet(meters: number): number {
  return meters * FT_PER_M;
}

export function feetToMeters(feet: number): number {
  return feet / FT_PER_M;
}

/** Derive the vessel length unit from the user's distance preference. */
export function lengthUnitFromDistance(unit: DistanceUnit): LengthUnit {
  return unit === 'mi' ? 'ft' : 'm';
}

/**
 * Convert a vessel size band label like "24-30m" or "80m+" to the target unit.
 * Falls back to the original label if parsing fails.
 */
export function convertSizeBandLabel(label: string, to: LengthUnit): string {
  if (to === 'm') return label;

  // Match patterns: "24-30m", "80m+"
  const rangeMatch = label.match(/^(\d+)-(\d+)m$/);
  if (rangeMatch) {
    const lo = Math.round(metersToFeet(parseInt(rangeMatch[1], 10)));
    const hi = Math.round(metersToFeet(parseInt(rangeMatch[2], 10)));
    return `${lo}-${hi}ft`;
  }

  const plusMatch = label.match(/^(\d+)m\+$/);
  if (plusMatch) {
    const val = Math.round(metersToFeet(parseInt(plusMatch[1], 10)));
    return `${val}ft+`;
  }

  return label;
}
