import { useState, useCallback, useMemo } from 'react';
import { View, Text, Pressable, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FlashList } from '@shopify/flash-list';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useConversations, type Conversation } from '@/hooks/use-conversations';
import { currencySymbol } from '@dockwalker/shared';

type Segment = 'active' | 'history';

function timeAgo(dateStr: string): string {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
  if (diff < 60) return `${diff}m`;
  const hours = Math.floor(diff / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

function ConversationRow({ conversation, onPress }: { conversation: Conversation; onPress: () => void }) {
  const profile = conversation.other_party_profile;
  const isDw = conversation.type === 'daywork';
  const jobRef = isDw
    ? `DW-${String(conversation.dayworks?.job_number ?? 0).padStart(5, '0')}`
    : `PM-${String(conversation.permanent_postings?.job_number ?? 0).padStart(5, '0')}`;
  const roleName = isDw
    ? conversation.dayworks?.yacht_roles?.name
    : conversation.permanent_postings?.yacht_roles?.name;
  const isHistory = conversation.status !== 'active' && (conversation.has_rated || conversation.rating_expired);
  const hasUnread = conversation.unread_count > 0;

  return (
    <Pressable
      onPress={onPress}
      style={{
        flexDirection: 'row',
        padding: 12,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#f3f4f6',
        opacity: isHistory ? 0.6 : 1,
      }}
    >
      {/* Avatar */}
      {profile?.avatar_url ? (
        <Image source={{ uri: profile.avatar_url }} style={{ width: 44, height: 44, borderRadius: 22, marginRight: 12 }} />
      ) : (
        <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: '#e5e7eb', marginRight: 12, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontSize: 16, color: '#9ca3af' }}>{(profile?.display_name ?? '?')[0].toUpperCase()}</Text>
        </View>
      )}

      {/* Content */}
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 }}>
          <Text style={{ fontSize: 15, fontWeight: hasUnread ? 'bold' : '600', color: '#111', flex: 1 }} numberOfLines={1}>
            {profile?.display_name ?? 'Unknown'}
          </Text>
          {conversation.last_message && (
            <Text style={{ fontSize: 11, color: '#9ca3af' }}>
              {timeAgo(conversation.last_message.created_at)}
            </Text>
          )}
        </View>
        <Text style={{ fontSize: 12, color: '#6b7280', marginBottom: 2 }}>
          {roleName ?? 'Role'} · {jobRef}
        </Text>
        {conversation.last_message && (
          <Text style={{ fontSize: 13, color: hasUnread ? '#111' : '#6b7280', fontWeight: hasUnread ? '500' : '400' }} numberOfLines={1}>
            {conversation.last_message.is_system ? '📋 ' : ''}{conversation.last_message.content}
          </Text>
        )}
      </View>

      {/* Unread badge */}
      {hasUnread && (
        <View style={{ backgroundColor: '#2563eb', borderRadius: 10, minWidth: 20, height: 20, alignItems: 'center', justifyContent: 'center', marginLeft: 8, alignSelf: 'center' }}>
          <Text style={{ color: '#fff', fontSize: 11, fontWeight: 'bold' }}>{conversation.unread_count}</Text>
        </View>
      )}
    </Pressable>
  );
}

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

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
      <View style={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 8 }}>
        <Text style={{ fontSize: 20, fontWeight: 'bold', color: '#111', marginBottom: 8 }}>Messages</Text>

        <View style={{ flexDirection: 'row', backgroundColor: '#e5e7eb', borderRadius: 8, padding: 2 }}>
          {([
            { key: 'active', label: `Active (${active.length})` },
            { key: 'history', label: `History (${history.length})` },
          ] as const).map((s) => (
            <Pressable
              key={s.key}
              onPress={() => setSegment(s.key)}
              style={{
                flex: 1, paddingVertical: 6, borderRadius: 6, alignItems: 'center',
                backgroundColor: segment === s.key ? '#fff' : 'transparent',
              }}
            >
              <Text style={{ fontSize: 13, fontWeight: segment === s.key ? '600' : '400', color: segment === s.key ? '#111' : '#6b7280' }}>
                {s.label}
              </Text>
            </Pressable>
          ))}
        </View>
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
          <View style={{ paddingTop: 60, alignItems: 'center' }}>
            <Text style={{ fontSize: 16, color: '#9ca3af' }}>
              {isLoading ? 'Loading...' : 'No conversations'}
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}
