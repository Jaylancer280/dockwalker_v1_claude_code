import { useState, useCallback } from 'react';
import { View, Text, Pressable, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FlashList } from '@shopify/flash-list';
import { router } from 'expo-router';
import { useNotifications, type Notification } from '@/hooks/use-notifications';
import { apiPost } from '@/lib/api';
import { Card, EmptyState, colors } from '@/components/ui';

function timeAgo(dateStr: string): string {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
  if (diff < 60) return `${diff}m ago`;
  const hours = Math.floor(diff / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function navigateDeepLink(deepLink: string) {
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
}

export default function NotificationsScreen() {
  const { data, isLoading, invalidate } = useNotifications();
  const [refreshing, setRefreshing] = useState(false);

  const notifications = data?.notifications ?? [];

  const handleTap = useCallback(async (notification: Notification) => {
    if (!notification.read) {
      apiPost(`/api/notifications/${notification.id}/read`);
    }
    if (notification.deep_link) {
      navigateDeepLink(notification.deep_link);
    }
  }, []);

  const handleMarkAllRead = useCallback(async () => {
    await apiPost('/api/notifications/read-all');
    invalidate();
  }, [invalidate]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await invalidate();
    setRefreshing(false);
  }, [invalidate]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f9fafb' }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingTop: 8, paddingBottom: 8 }}>
        <Text style={{ fontSize: 20, fontWeight: 'bold', color: '#111' }}>Notifications</Text>
        {(data?.unread_count ?? 0) > 0 && (
          <Pressable onPress={handleMarkAllRead}>
            <Text style={{ fontSize: 13, color: colors.primary }}>Mark all read</Text>
          </Pressable>
        )}
      </View>

      <FlashList
        data={notifications}
        keyExtractor={(n) => n.id}
        renderItem={({ item }) => (
          <View style={{ paddingHorizontal: 16, marginBottom: 6 }}>
            <Pressable onPress={() => handleTap(item)}>
              <Card style={{ opacity: item.read ? 0.7 : 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                  {!item.read && (
                    <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary, marginRight: 8, marginTop: 5 }} />
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 14, fontWeight: item.read ? '400' : '600', color: '#111' }}>{item.title}</Text>
                    <Text style={{ fontSize: 13, color: '#6b7280', marginTop: 2 }}>{item.body}</Text>
                    <Text style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>{timeAgo(item.created_at)}</Text>
                  </View>
                </View>
              </Card>
            </Pressable>
          </View>
        )}
        estimatedItemSize={80}
        contentContainerStyle={{ paddingTop: 4, paddingBottom: 16 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
        ListEmptyComponent={
          <EmptyState message={isLoading ? 'Loading...' : 'No notifications yet'} />
        }
      />
    </SafeAreaView>
  );
}
