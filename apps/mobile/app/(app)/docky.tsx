import { useState, useCallback } from 'react';
import { View, Text, Pressable, RefreshControl, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FlashList } from '@shopify/flash-list';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useDockyConversations, type DockyConversation } from '@/hooks/use-docky-conversations';
import { useDockyUsage } from '@/hooks/use-docky-usage';
import { apiPost, apiDelete } from '@/lib/api';
import { ScreenHeader, Card, Button, EmptyState, colors } from '@/components/ui';

function timeAgo(dateStr: string): string {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
  if (diff < 60) return `${diff}m ago`;
  const hours = Math.floor(diff / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export default function DockyScreen() {
  const { data, isLoading, invalidate } = useDockyConversations();
  const { data: usage } = useDockyUsage();
  const [refreshing, setRefreshing] = useState(false);

  const conversations = data?.conversations ?? [];

  const usageLabel = usage?.plan
    ? 'Pro'
    : usage?.used != null && usage?.limit != null
      ? `${usage.used}/${usage.limit}`
      : '';

  const handleNewConversation = useCallback(async () => {
    const result = await apiPost<{ id: string }>('/api/advisor/conversations');
    if (result.ok) {
      invalidate();
      router.push(`/(app)/docky/${result.data.id}`);
    } else {
      Alert.alert('Error', result.error);
    }
  }, [invalidate]);

  const handleDelete = useCallback((conv: DockyConversation) => {
    Alert.alert('Delete conversation?', `"${conv.title}" will be permanently removed.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const result = await apiDelete(`/api/advisor/conversations/${conv.id}`);
          if (result.ok) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            invalidate();
          } else {
            Alert.alert('Error', result.error);
          }
        },
      },
    ]);
  }, [invalidate]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await invalidate();
    setRefreshing(false);
  }, [invalidate]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f9fafb' }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingTop: 8, paddingBottom: 8 }}>
        <ScreenHeader title="Docky" subtitle="Your maritime AI advisor" onBack={() => router.back()} />
        {usageLabel ? (
          <View style={{ backgroundColor: '#eff6ff', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 }}>
            <Text style={{ fontSize: 11, color: colors.primary, fontWeight: '600' }}>{usageLabel}</Text>
          </View>
        ) : null}
      </View>

      <FlashList
        data={conversations}
        keyExtractor={(c) => c.id}
        renderItem={({ item }) => (
          <View style={{ paddingHorizontal: 16, marginBottom: 8 }}>
            <Pressable
              onPress={() => router.push(`/(app)/docky/${item.id}`)}
              onLongPress={() => handleDelete(item)}
            >
              <Card>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <View style={{ flex: 1, marginRight: 8 }}>
                    <Text style={{ fontSize: 15, fontWeight: '600', color: '#111' }} numberOfLines={1}>{item.title}</Text>
                    {item.preview && (
                      <Text style={{ fontSize: 13, color: '#6b7280', marginTop: 2 }} numberOfLines={2}>{item.preview}</Text>
                    )}
                  </View>
                  <Text style={{ fontSize: 11, color: '#9ca3af' }}>{timeAgo(item.updated_at)}</Text>
                </View>
              </Card>
            </Pressable>
          </View>
        )}
        estimatedItemSize={80}
        contentContainerStyle={{ paddingTop: 8, paddingBottom: 80 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
        ListEmptyComponent={
          isLoading ? (
            <EmptyState message="Loading..." />
          ) : (
            <View style={{ paddingTop: 60, alignItems: 'center', paddingHorizontal: 32 }}>
              <Text style={{ fontSize: 40, marginBottom: 12 }}>🛟</Text>
              <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#111', marginBottom: 4 }}>Meet Docky</Text>
              <Text style={{ fontSize: 14, color: '#6b7280', textAlign: 'center' }}>
                Your AI maritime advisor. Ask about MCA certifications, career paths, and crew regulations.
              </Text>
            </View>
          )
        }
      />

      <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: 16, backgroundColor: '#f9fafb' }}>
        <Button variant="primary" label="New conversation" onPress={handleNewConversation} />
      </View>
    </SafeAreaView>
  );
}
