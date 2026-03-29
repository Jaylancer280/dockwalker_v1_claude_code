import { View, Text } from 'react-native';
import type { Message } from '@/hooks/use-messages';
import { colors } from '@/components/ui';

interface MessageBubbleProps {
  message: Message;
  isOwn: boolean;
}

export function MessageBubble({ message, isOwn }: MessageBubbleProps) {
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
        backgroundColor: isOwn ? colors.primary : '#f3f4f6',
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
