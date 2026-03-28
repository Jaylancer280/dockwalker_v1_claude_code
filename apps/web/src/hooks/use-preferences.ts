'use client';

import { useState } from 'react';
import type { CurrencyCode, DistanceUnit, LengthUnit } from '@dockwalker/shared';
import { lengthUnitFromDistance } from '@dockwalker/shared';

const STORAGE_KEYS = {
  distanceUnit: 'dw-distance-unit',
  currency: 'dw-currency-pref',
} as const;

const DEFAULTS = {
  distanceUnit: 'km' as DistanceUnit,
  currency: 'EUR' as CurrencyCode,
} as const;

export interface UserPreferences {
  distanceUnit: DistanceUnit;
  lengthUnit: LengthUnit;
  currency: CurrencyCode;
}

function readDistanceUnit(): DistanceUnit {
  if (typeof window === 'undefined') return DEFAULTS.distanceUnit;
  const saved = localStorage.getItem(STORAGE_KEYS.distanceUnit);
  if (saved === 'km' || saved === 'mi' || saved === 'nm') return saved;
  return DEFAULTS.distanceUnit;
}

function readCurrency(): CurrencyCode {
  if (typeof window === 'undefined') return DEFAULTS.currency;
  const saved = localStorage.getItem(STORAGE_KEYS.currency);
  if (saved === 'EUR' || saved === 'USD' || saved === 'GBP' || saved === 'AED') return saved;
  return DEFAULTS.currency;
}

/**
 * Reads user preferences from localStorage via lazy state initialization.
 * SSR-safe: returns defaults when window is undefined.
 */
export function usePreferences(): UserPreferences {
  const [distanceUnit] = useState<DistanceUnit>(readDistanceUnit);
  const [currency] = useState<CurrencyCode>(readCurrency);

  return {
    distanceUnit,
    lengthUnit: lengthUnitFromDistance(distanceUnit),
    currency,
  };
}
