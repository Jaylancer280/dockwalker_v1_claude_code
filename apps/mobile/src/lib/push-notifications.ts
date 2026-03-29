import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { router } from 'expo-router';
import { apiPost, apiDelete } from '@/lib/api';

let storedToken: string | null = null;

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: false,
    shouldPlaySound: false,
    shouldSetBadge: false,
    shouldShowBanner: false,
    shouldShowList: false,
  }),
});

export async function registerPushToken(): Promise<void> {
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') return;

  const { data: token } = await Notifications.getExpoPushTokenAsync();
  if (!token) return;

  if (storedToken === token) return;

  const platform = Platform.OS === 'ios' ? 'apns' : 'fcm';
  const result = await apiPost('/api/push-tokens', { token, platform });
  if (result.ok) {
    storedToken = token;
  }
}

export async function deregisterPushToken(): Promise<void> {
  if (!storedToken) return;

  await apiDelete('/api/push-tokens', { token: storedToken });
  storedToken = null;
}

export function setupNotificationListeners(): () => void {
  const tapSub = Notifications.addNotificationResponseReceivedListener((response) => {
    const data = response.notification.request.content.data as Record<string, string> | undefined;
    const deepLink = data?.deep_link ?? data?.screen;
    if (!deepLink) return;

    if (deepLink.startsWith('chat:')) {
      router.push(`/(app)/messages/${deepLink.replace('chat:', '')}`);
    } else if (deepLink === 'discover') {
      router.push('/(app)/(tabs)/discover');
    } else if (deepLink.startsWith('review:daywork:')) {
      router.push(`/(app)/daywork/${deepLink.replace('review:daywork:', '')}/review`);
    } else if (deepLink.startsWith('review:permanent:')) {
      router.push(`/(app)/permanent/${deepLink.replace('review:permanent:', '')}/review`);
    } else if (deepLink === 'profile') {
      router.push('/(app)/(tabs)/profile');
    }
  });

  return () => {
    tapSub.remove();
  };
}
