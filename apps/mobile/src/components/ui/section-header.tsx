import { View, Text } from 'react-native';

interface SectionHeaderProps {
  title: string;
  subtitle?: string;
}

export function SectionHeader({ title, subtitle }: SectionHeaderProps) {
  return (
    <View style={{ marginBottom: 8 }}>
      <Text style={{ fontSize: 13, fontWeight: '600', color: '#374151' }}>{title}</Text>
      {subtitle && <Text style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>{subtitle}</Text>}
    </View>
  );
}
