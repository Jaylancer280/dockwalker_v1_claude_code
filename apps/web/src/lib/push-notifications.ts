import { Capacitor } from '@capacitor/core';
import { safeFetch } from '@/lib/safe-fetch';

const TOKEN_STORAGE_KEY = 'dw_push_token';

function getPlatformType(): 'apns' | 'fcm' {
  return Capacitor.getPlatform() === 'ios' ? 'apns' : 'fcm';
}

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

    PushNotifications.addListener('registration', async (tokenData) => {
      const token = tokenData.value;
      const previousToken = localStorage.getItem(TOKEN_STORAGE_KEY);

      // Only re-POST if token changed
      if (token === previousToken) return;

      const result = await safeFetch('/api/push-tokens', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, platform: getPlatformType() }),
      });
      if (result.ok) {
        localStorage.setItem(TOKEN_STORAGE_KEY, token);
      }
    });

    PushNotifications.addListener('registrationError', (error) => {
      console.error('[Push] Registration error:', error);
    });

    // Foreground push: show in-app toast banner
    PushNotifications.addListener('pushNotificationReceived', (notification) => {
      const data = (notification.data ?? {}) as Record<string, string>;
      const url = resolveDeepLinkUrl(data);

      // Suppress if user is already on the relevant screen
      if (url && window.location.pathname === new URL(url, window.location.origin).pathname) {
        return;
      }

      window.dispatchEvent(
        new CustomEvent('dw:push-foreground', {
          detail: {
            title: notification.title ?? '',
            body: notification.body ?? '',
            url,
          },
        }),
      );
    });

    // Tap navigation: deep link into the app
    PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
      const data = (action.notification.data ?? {}) as Record<string, string>;
      const url = resolveDeepLinkUrl(data);
      if (url) {
        window.location.href = url;
      }
    });
  } catch (err) {
    console.error('[Push] Setup failed:', err);
  }
}

/**
 * Remove the stored push token from the server on sign-out.
 */
export async function deregisterPushToken() {
  const token = localStorage.getItem(TOKEN_STORAGE_KEY);
  if (!token) return;

  void safeFetch('/api/push-tokens', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token }),
  });

  localStorage.removeItem(TOKEN_STORAGE_KEY);
}

/**
 * Map push notification data to an in-app URL.
 * Returns undefined if no mapping exists.
 */
export function resolveDeepLinkUrl(data: Record<string, string>): string | undefined {
  const screen = data.screen;
  if (!screen) return undefined;

  switch (screen) {
    case 'chat':
      return data.engagementId ? `/messages/${data.engagementId}` : '/messages';
    case 'discover':
      return data.type === 'invitation' ? '/discover?tab=invitations' : '/discover';
    case 'review':
      return data.dayworkId ? `/daywork/${data.dayworkId}/review` : undefined;
    default:
      return undefined;
  }
}
