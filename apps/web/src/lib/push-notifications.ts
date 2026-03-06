import { Capacitor } from '@capacitor/core';

/**
 * Push notification registration for native platforms.
 * No-ops on web.
 */
export async function registerPushNotifications() {
  if (!Capacitor.isNativePlatform()) return;

  try {
    const { PushNotifications } = await import('@capacitor/push-notifications');

    const permission = await PushNotifications.requestPermissions();
    if (permission.receive !== 'granted') return;

    await PushNotifications.register();

    // Deferred: Send token to server for push delivery
    PushNotifications.addListener('registration', () => {});

    PushNotifications.addListener('registrationError', (error) => {
      console.error('[Push] Registration error:', error);
    });

    // Deferred: Handle foreground push notification display
    PushNotifications.addListener('pushNotificationReceived', () => {});

    // Deferred: Handle push notification tap navigation
    PushNotifications.addListener('pushNotificationActionPerformed', () => {});
  } catch (err) {
    console.error('[Push] Setup failed:', err);
  }
}
