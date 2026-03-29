import { View, Text, Pressable } from 'react-native';

interface ScreenHeaderProps {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  backLabel?: string;
}

export function ScreenHeader({ title, subtitle, onBack, backLabel }: ScreenHeaderProps) {
  return (
    <View style={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 8 }}>
      {onBack && (
        <Pressable onPress={onBack}>
          <Text style={{ fontSize: 14, color: '#2563eb' }}>{backLabel ?? '← Back'}</Text>
        </Pressable>
      )}
      <Text style={{ fontSize: 20, fontWeight: 'bold', color: '#111', marginTop: onBack ? 4 : 0 }}>{title}</Text>
      {subtitle && <Text style={{ fontSize: 13, color: '#6b7280', marginTop: 2 }}>{subtitle}</Text>}
    </View>
  );
}
