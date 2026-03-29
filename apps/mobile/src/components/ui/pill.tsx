import { Pressable, Text } from 'react-native';

interface PillProps {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  disabled?: boolean;
}

export function Pill({ label, selected, onPress, disabled }: PillProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={{
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 16,
        backgroundColor: selected ? '#2563eb' : '#f3f4f6',
      }}
    >
      <Text style={{ fontSize: 12, color: selected ? '#fff' : '#4b5563' }}>{label}</Text>
    </Pressable>
  );
}
