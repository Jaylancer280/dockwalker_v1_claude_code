import { useState, useCallback, useMemo } from 'react';
import { View, Text, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FlashList } from '@shopify/flash-list';
import { router } from 'expo-router';
import { useConversations } from '@/hooks/use-conversations';
import { ConversationRow } from '@/components/conversation-row';
import { TabBar, EmptyState } from '@/components/ui';

type Segment = 'active' | 'history';

export default function MessagesScreen() {
  const { data, isLoading, refetch } = useConversations();
  const [segment, setSegment] = useState<Segment>('active');
  const [refreshing, setRefreshing] = useState(false);

  const conversations = data?.conversations ?? [];

  const active = useMemo(
    () => conversations.filter((c) => c.status === 'active' || (!c.has_rated && !c.rating_expired && c.status === 'completed')),
    [conversations],
  );
  const history = useMemo(
    () => conversations.filter((c) => (c.has_rated || c.rating_expired || c.status === 'cancelled') && c.status !== 'active'),
    [conversations],
  );

  const items = segment === 'active' ? active : history;

  const tabs = useMemo(() => [
    { key: 'active', label: `Active (${active.length})` },
    { key: 'history', label: `History (${history.length})` },
  ], [active.length, history.length]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
      <View style={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 8 }}>
        <Text style={{ fontSize: 20, fontWeight: 'bold', color: '#111', marginBottom: 8 }}>Messages</Text>
        <TabBar tabs={tabs} activeTab={segment} onChange={(k) => setSegment(k as Segment)} />
      </View>

      <FlashList
        data={items}
        keyExtractor={(c) => c.id}
        renderItem={({ item }) => (
          <ConversationRow
            conversation={item}
            onPress={() => router.push(`/(app)/messages/${item.id}`)}
          />
        )}
        estimatedItemSize={80}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
        ListEmptyComponent={
          <EmptyState message={isLoading ? 'Loading...' : 'No conversations'} />
        }
      />
    </SafeAreaView>
  );
}
