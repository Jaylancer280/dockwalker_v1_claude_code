import { useState, useCallback, useRef, useEffect } from 'react';
import { View, Text, TextInput, Pressable, FlatList, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { useAuth } from '@/lib/auth-context';
import { useMessages, type Message } from '@/hooks/use-messages';
import { useEngagementContext } from '@/hooks/use-engagement-context';
import { useRealtimeMessages } from '@/hooks/use-realtime-messages';
import { DayworkSummaryCardChat } from '@/components/daywork-summary-card-chat';
import { PermanentSummaryCardChat } from '@/components/permanent-summary-card-chat';
import { apiPost } from '@/lib/api';

function MessageBubble({ message, isOwn }: { message: Message; isOwn: boolean }) {
  if (message.is_system) {
    return (
      <View style={{ alignItems: 'center', paddingVertical: 6, paddingHorizontal: 16 }}>
        <Text style={{ fontSize: 12, color: '#9ca3af', textAlign: 'center', fontStyle: 'italic' }}>
          {message.content}
        </Text>
      </View>
    );
  }

  return (
    <View style={{ alignItems: isOwn ? 'flex-end' : 'flex-start', paddingHorizontal: 16, paddingVertical: 3 }}>
      <View style={{
        maxWidth: '80%',
        backgroundColor: isOwn ? '#2563eb' : '#f3f4f6',
        borderRadius: 16,
        borderBottomRightRadius: isOwn ? 4 : 16,
        borderBottomLeftRadius: isOwn ? 16 : 4,
        paddingHorizontal: 14,
        paddingVertical: 8,
      }}>
        <Text style={{ fontSize: 15, color: isOwn ? '#fff' : '#111' }}>{message.content}</Text>
        <Text style={{ fontSize: 10, color: isOwn ? 'rgba(255,255,255,0.6)' : '#9ca3af', marginTop: 2, textAlign: 'right' }}>
          {new Date(message.created_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
        </Text>
      </View>
    </View>
  );
}

export default function ChatScreen() {
  const { engagementId } = useLocalSearchParams<{ engagementId: string }>();
  const { user } = useAuth();
  const { data: messagesData, appendMessage } = useMessages(engagementId);
  const { data: context } = useEngagementContext(engagementId);
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  const messages = messagesData?.messages ?? [];
  const isDaywork = context?.type === 'daywork';
  const isActive = context?.status === 'active';

  // Realtime messages
  useRealtimeMessages(engagementId, (msg) => {
    if (msg.sender_person_id !== user?.id) {
      appendMessage(msg);
    }
  });

  // Mark as read on mount
  useEffect(() => {
    if (engagementId) {
      apiPost(`/api/messages/${engagementId}/read`);
    }
  }, [engagementId]);

  // Auto-scroll on new messages
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [messages.length]);

  const handleSend = useCallback(async () => {
    const content = inputText.trim();
    if (!content || sending) return;

    setSending(true);
    setInputText('');

    // Optimistic append — display immediately
    const optimisticMsg: Message = {
      id: `optimistic-${Date.now()}`,
      sender_person_id: user?.id ?? '',
      content,
      created_at: new Date().toISOString(),
      is_system: false,
    };
    appendMessage(optimisticMsg);

    const result = await apiPost(`/api/messages/${engagementId}`, { content });
    setSending(false);

    if (!result.ok) {
      Alert.alert('Failed to send', result.error);
    }
  }, [inputText, sending, engagementId, appendMessage, user?.id]);

  const otherName = context?.other_party?.display_name ?? 'Chat';
  const jobRef = isDaywork
    ? context?.daywork ? `DW-${String(context.daywork.job_number).padStart(5, '0')}` : ''
    : context?.permanent_posting ? `PM-${String(context.permanent_posting.job_number).padStart(5, '0')}` : '';
  const roleName = isDaywork
    ? context?.daywork?.yacht_roles?.name
    : context?.permanent_posting?.yacht_roles?.name;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' }}>
        <Pressable onPress={() => router.back()} style={{ marginRight: 12 }}>
          <Text style={{ fontSize: 14, color: '#2563eb' }}>←</Text>
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#111' }}>{otherName}</Text>
          <Text style={{ fontSize: 12, color: '#6b7280' }}>{roleName}{jobRef ? ` · ${jobRef}` : ''}</Text>
        </View>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(m) => m.id}
          renderItem={({ item }) => (
            <MessageBubble message={item} isOwn={item.sender_person_id === user?.id} />
          )}
          contentContainerStyle={{ paddingVertical: 8 }}
          ListHeaderComponent={
            context ? (
              isDaywork && context.daywork ? (
                <DayworkSummaryCardChat daywork={context.daywork} />
              ) : !isDaywork && context.permanent_posting ? (
                <PermanentSummaryCardChat posting={context.permanent_posting} />
              ) : null
            ) : null
          }
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
        />

        {/* Input footer */}
        {isActive ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderTopWidth: 1, borderTopColor: '#f3f4f6', backgroundColor: '#fff' }}>
            <TextInput
              value={inputText}
              onChangeText={setInputText}
              placeholder="Type a message..."
              multiline
              maxLength={2000}
              style={{ flex: 1, borderWidth: 1, borderColor: '#d1d5db', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, fontSize: 15, maxHeight: 100 }}
            />
            <Pressable
              onPress={handleSend}
              disabled={!inputText.trim() || sending}
              style={{ marginLeft: 8, backgroundColor: inputText.trim() ? '#2563eb' : '#d1d5db', borderRadius: 20, width: 36, height: 36, alignItems: 'center', justifyContent: 'center' }}
            >
              <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 16 }}>↑</Text>
            </Pressable>
          </View>
        ) : (
          <View style={{ padding: 16, backgroundColor: '#f9fafb', borderTopWidth: 1, borderTopColor: '#f3f4f6' }}>
            <Text style={{ fontSize: 13, color: '#6b7280', textAlign: 'center' }}>
              {context?.status === 'cancelled' ? 'This engagement was cancelled' : 'This conversation is closed'}
            </Text>
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
