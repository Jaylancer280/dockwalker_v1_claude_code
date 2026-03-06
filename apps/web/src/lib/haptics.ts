import { Capacitor } from '@capacitor/core';

/**
 * Haptic feedback utilities for native swipe actions.
 * No-ops gracefully on web.
 */

let Haptics: typeof import('@capacitor/haptics').Haptics | null = null;
let ImpactStyle: typeof import('@capacitor/haptics').ImpactStyle | undefined;

if (Capacitor.isNativePlatform()) {
  import('@capacitor/haptics').then((mod) => {
    Haptics = mod.Haptics;
    ImpactStyle = mod.ImpactStyle;
  });
}

export async function hapticLight() {
  if (Haptics && ImpactStyle) {
    await Haptics.impact({ style: ImpactStyle.Light });
  }
}

export async function hapticMedium() {
  if (Haptics && ImpactStyle) {
    await Haptics.impact({ style: ImpactStyle.Medium });
  }
}

export async function hapticHeavy() {
  if (Haptics && ImpactStyle) {
    await Haptics.impact({ style: ImpactStyle.Heavy });
  }
}

export async function hapticSuccess() {
  if (Haptics) {
    await Haptics.notification({ type: 'success' as never });
  }
}

export async function hapticError() {
  if (Haptics) {
    await Haptics.notification({ type: 'error' as never });
  }
}
