import { View, Text, Pressable } from 'react-native';

interface BoolToggleProps {
  label: string;
  value: boolean | null;
  onChange: (v: boolean) => void;
}

export function BoolToggle({ label, value, onChange }: BoolToggleProps) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
      <Text style={{ fontSize: 13, color: '#374151', flex: 1 }}>{label}</Text>
      <View style={{ flexDirection: 'row', gap: 6 }}>
        <Pressable
          onPress={() => onChange(true)}
          style={{
            paddingHorizontal: 14,
            paddingVertical: 6,
            borderRadius: 16,
            backgroundColor: value === true ? '#2563eb' : '#f3f4f6',
          }}
        >
          <Text style={{ fontSize: 13, color: value === true ? '#fff' : '#4b5563' }}>Yes</Text>
        </Pressable>
        <Pressable
          onPress={() => onChange(false)}
          style={{
            paddingHorizontal: 14,
            paddingVertical: 6,
            borderRadius: 16,
            backgroundColor: value === false ? '#2563eb' : '#f3f4f6',
          }}
        >
          <Text style={{ fontSize: 13, color: value === false ? '#fff' : '#4b5563' }}>No</Text>
        </Pressable>
      </View>
    </View>
  );
}
