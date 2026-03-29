import { View, Text } from 'react-native';

interface EmptyStateProps {
  message: string;
}

export function EmptyState({ message }: EmptyStateProps) {
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 60 }}>
      <Text style={{ fontSize: 16, color: '#9ca3af' }}>{message}</Text>
    </View>
  );
}
