'use client';

import { useEffect } from 'react';
import { registerPushNotifications } from '@/lib/push-notifications';

/**
 * Initializes native platform features (push notifications, etc.)
 * on first mount. Renders nothing.
 */
export function NativeInit() {
  useEffect(() => {
    registerPushNotifications();
  }, []);

  return null;
}
