import { View, Text, Pressable } from 'react-native';
import { Image } from 'expo-image';
import type { Conversation } from '@/hooks/use-conversations';
import { colors } from '@/components/ui';

function timeAgo(dateStr: string): string {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
  if (diff < 60) return `${diff}m`;
  const hours = Math.floor(diff / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

interface ConversationRowProps {
  conversation: Conversation;
  onPress: () => void;
}

export function ConversationRow({ conversation, onPress }: ConversationRowProps) {
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
      {profile?.avatar_url ? (
        <Image source={{ uri: profile.avatar_url }} style={{ width: 44, height: 44, borderRadius: 22, marginRight: 12 }} />
      ) : (
        <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: '#e5e7eb', marginRight: 12, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontSize: 16, color: '#9ca3af' }}>{(profile?.display_name ?? '?')[0].toUpperCase()}</Text>
        </View>
      )}

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

      {hasUnread && (
        <View style={{ backgroundColor: colors.primary, borderRadius: 10, minWidth: 20, height: 20, alignItems: 'center', justifyContent: 'center', marginLeft: 8, alignSelf: 'center' }}>
          <Text style={{ color: '#fff', fontSize: 11, fontWeight: 'bold' }}>{conversation.unread_count}</Text>
        </View>
      )}
    </Pressable>
  );
}
