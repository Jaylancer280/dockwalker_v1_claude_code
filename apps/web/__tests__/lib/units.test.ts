import { describe, it, expect } from 'vitest';
import {
  currencySymbol,
  formatRate,
  convertDistance,
  formatDistance,
  metersToFeet,
  feetToMeters,
  convertSizeBandLabel,
  lengthUnitFromDistance,
} from '@dockwalker/shared';

describe('currencySymbol', () => {
  it('returns correct symbols for known codes', () => {
    expect(currencySymbol('EUR')).toBe('\u20AC');
    expect(currencySymbol('USD')).toBe('$');
    expect(currencySymbol('GBP')).toBe('\u00A3');
    expect(currencySymbol('AED')).toBe('\u062F.\u0625');
  });

  it('falls back to EUR symbol for unknown codes', () => {
    expect(currencySymbol('XYZ')).toBe('\u20AC');
  });
});

describe('formatRate', () => {
  it('formats rate with currency symbol', () => {
    expect(formatRate(250, 'EUR')).toBe('\u20AC250/day');
    expect(formatRate(300, 'USD')).toBe('$300/day');
  });
});

describe('convertDistance', () => {
  it('returns same value for identical units', () => {
    expect(convertDistance(100, 'km', 'km')).toBe(100);
  });

  it('converts km to miles', () => {
    const result = convertDistance(100, 'km', 'mi');
    expect(result).toBeCloseTo(62.137, 2);
  });

  it('converts miles to km', () => {
    const result = convertDistance(100, 'mi', 'km');
    expect(result).toBeCloseTo(160.934, 2);
  });

  it('converts km to nautical miles', () => {
    const result = convertDistance(1.852, 'km', 'nm');
    expect(result).toBeCloseTo(1, 3);
  });

  it('converts nautical miles to km', () => {
    const result = convertDistance(1, 'nm', 'km');
    expect(result).toBeCloseTo(1.852, 3);
  });

  it('converts miles to nautical miles', () => {
    const result = convertDistance(100, 'mi', 'nm');
    expect(result).toBeCloseTo(86.898, 2);
  });
});

describe('formatDistance', () => {
  it('formats km distances', () => {
    expect(formatDistance(12.5, 'km')).toBe('12.5 km');
  });

  it('formats miles', () => {
    expect(formatDistance(7.8, 'mi')).toBe('7.8 mi');
  });

  it('formats nautical miles', () => {
    expect(formatDistance(5.0, 'nm')).toBe('5.0 NM');
  });

  it('respects decimal places', () => {
    expect(formatDistance(12.345, 'km', 0)).toBe('12 km');
    expect(formatDistance(12.345, 'km', 2)).toBe('12.35 km');
  });
});

describe('metersToFeet / feetToMeters', () => {
  it('converts meters to feet', () => {
    expect(metersToFeet(1)).toBeCloseTo(3.28084, 3);
    expect(metersToFeet(30)).toBeCloseTo(98.425, 1);
  });

  it('converts feet to meters', () => {
    expect(feetToMeters(3.28084)).toBeCloseTo(1, 3);
    expect(feetToMeters(100)).toBeCloseTo(30.48, 1);
  });

  it('round-trips accurately', () => {
    expect(feetToMeters(metersToFeet(50))).toBeCloseTo(50, 5);
  });
});

describe('lengthUnitFromDistance', () => {
  it('returns ft for imperial miles', () => {
    expect(lengthUnitFromDistance('mi')).toBe('ft');
  });

  it('returns m for metric km', () => {
    expect(lengthUnitFromDistance('km')).toBe('m');
  });

  it('returns m for nautical miles', () => {
    expect(lengthUnitFromDistance('nm')).toBe('m');
  });
});

describe('convertSizeBandLabel', () => {
  it('returns original label when target is meters', () => {
    expect(convertSizeBandLabel('24-30m', 'm')).toBe('24-30m');
    expect(convertSizeBandLabel('80m+', 'm')).toBe('80m+');
  });

  it('converts range labels to feet', () => {
    const result = convertSizeBandLabel('24-30m', 'ft');
    expect(result).toBe('79-98ft');
  });

  it('converts plus labels to feet', () => {
    const result = convertSizeBandLabel('80m+', 'ft');
    expect(result).toBe('262ft+');
  });

  it('converts all canonical size bands', () => {
    expect(convertSizeBandLabel('24-30m', 'ft')).toBe('79-98ft');
    expect(convertSizeBandLabel('30-40m', 'ft')).toBe('98-131ft');
    expect(convertSizeBandLabel('40-50m', 'ft')).toBe('131-164ft');
    expect(convertSizeBandLabel('50-60m', 'ft')).toBe('164-197ft');
    expect(convertSizeBandLabel('60-80m', 'ft')).toBe('197-262ft');
    expect(convertSizeBandLabel('80m+', 'ft')).toBe('262ft+');
  });

  it('falls back to original label for unrecognized formats', () => {
    expect(convertSizeBandLabel('Unknown', 'ft')).toBe('Unknown');
  });
});
