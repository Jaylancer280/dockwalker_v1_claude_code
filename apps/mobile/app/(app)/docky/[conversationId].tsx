import { useState, useCallback, useRef } from 'react';
import { View, Text, TextInput, Pressable, FlatList, KeyboardAvoidingView, Platform, Alert, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { useAuth } from '@/lib/auth-context';
import { useDockyMessages, type DockyMessage } from '@/hooks/use-docky-messages';
import { useDockyConversations } from '@/hooks/use-docky-conversations';
import { apiPost } from '@/lib/api';
import { colors } from '@/components/ui';

function DockyBubble({ message }: { message: DockyMessage }) {
  const [showSources, setShowSources] = useState(false);
  const isUser = message.role === 'user';
  const sourcesArr = Array.isArray(message.sources) ? (message.sources as { title: string; content: string }[]) : [];
  const hasSources = sourcesArr.length > 0;

  return (
    <View style={{ alignItems: isUser ? 'flex-end' : 'flex-start', paddingHorizontal: 16, paddingVertical: 3 }}>
      {!isUser && (
        <Text style={{ fontSize: 11, color: '#9ca3af', marginBottom: 2, marginLeft: 4 }}>🛟 Docky</Text>
      )}
      <View style={{
        maxWidth: '85%',
        backgroundColor: isUser ? colors.primary : '#f3f4f6',
        borderRadius: 16,
        borderBottomRightRadius: isUser ? 4 : 16,
        borderBottomLeftRadius: isUser ? 16 : 4,
        paddingHorizontal: 14,
        paddingVertical: 10,
      }}>
        <Text style={{ fontSize: 15, color: isUser ? '#fff' : '#111', lineHeight: 22 }}>{message.content}</Text>
      </View>
      {hasSources && (
        <Pressable onPress={() => setShowSources(!showSources)} style={{ marginTop: 4, marginLeft: 4 }}>
          <Text style={{ fontSize: 11, color: colors.primary }}>{showSources ? 'Hide sources ▲' : 'Show sources ▼'}</Text>
        </Pressable>
      )}
      {showSources && hasSources && (
        <View style={{ marginLeft: 4, marginTop: 4, backgroundColor: '#f9fafb', borderRadius: 8, padding: 8 }}>
          {sourcesArr.map((s, i) => (
            <View key={i} style={{ marginBottom: i < sourcesArr.length - 1 ? 6 : 0 }}>
              <Text style={{ fontSize: 11, fontWeight: '600', color: '#374151' }}>{s.title}</Text>
              <Text style={{ fontSize: 11, color: '#6b7280' }} numberOfLines={3}>{s.content}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

export default function DockyConversationScreen() {
  const { conversationId } = useLocalSearchParams<{ conversationId: string }>();
  const { user } = useAuth();
  const { data, appendMessage } = useDockyMessages(conversationId);
  const { invalidate: invalidateConversations } = useDockyConversations();
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const [thinking, setThinking] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  const messages = data?.messages ?? [];

  const handleSend = useCallback(async () => {
    const content = inputText.trim();
    if (!content || sending) return;

    setSending(true);
    setInputText('');

    const userMsg: DockyMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content,
      sources: null,
      created_at: new Date().toISOString(),
    };
    appendMessage(userMsg);

    setThinking(true);
    const result = await apiPost<DockyMessage>(`/api/advisor/conversations/${conversationId}/messages`, { content });
    setThinking(false);
    setSending(false);

    if (result.ok) {
      appendMessage(result.data);
      invalidateConversations();
    } else if (result.error.includes('limit') || result.error.includes('402')) {
      Alert.alert(
        'Monthly limit reached',
        'Upgrade to Crew Pro for unlimited Docky conversations.',
        [
          { text: 'Later', style: 'cancel' },
          { text: 'Upgrade', onPress: () => Linking.openURL('https://dockwalker.io/billing') },
        ],
      );
    } else {
      Alert.alert('Error', result.error);
    }
  }, [inputText, sending, conversationId, appendMessage, invalidateConversations]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' }}>
        <Pressable onPress={() => router.back()} style={{ marginRight: 12 }}>
          <Text style={{ fontSize: 14, color: colors.primary }}>←</Text>
        </Pressable>
        <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#111' }}>🛟 Docky</Text>
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
          renderItem={({ item }) => <DockyBubble message={item} />}
          contentContainerStyle={{ paddingVertical: 8 }}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
          ListEmptyComponent={
            <View style={{ paddingTop: 60, alignItems: 'center', paddingHorizontal: 32 }}>
              <Text style={{ fontSize: 15, color: '#6b7280', textAlign: 'center' }}>
                Ask Docky about MCA certifications, career paths, or yacht industry regulations.
              </Text>
            </View>
          }
        />

        {thinking && (
          <View style={{ paddingHorizontal: 20, paddingVertical: 8 }}>
            <Text style={{ fontSize: 13, color: '#9ca3af', fontStyle: 'italic' }}>Docky is thinking...</Text>
          </View>
        )}

        {/* Input */}
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderTopWidth: 1, borderTopColor: '#f3f4f6', backgroundColor: '#fff' }}>
          <TextInput
            value={inputText}
            onChangeText={setInputText}
            placeholder="Ask Docky..."
            multiline
            maxLength={500}
            style={{ flex: 1, borderWidth: 1, borderColor: '#d1d5db', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, fontSize: 15, maxHeight: 100 }}
          />
          <Pressable
            onPress={handleSend}
            disabled={!inputText.trim() || sending}
            style={{ marginLeft: 8, backgroundColor: inputText.trim() ? colors.primary : '#d1d5db', borderRadius: 20, width: 36, height: 36, alignItems: 'center', justifyContent: 'center' }}
          >
            <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 16 }}>↑</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
