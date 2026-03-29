import { View, Text, Pressable } from 'react-native';

interface YesNoPartialPickerProps {
  label?: string;
  value: string | null;
  options?: { value: string; label: string }[];
  onChange: (v: string) => void;
}

const DEFAULT_OPTIONS = [
  { value: 'yes', label: 'Yes' },
  { value: 'no', label: 'No' },
  { value: 'partial', label: 'Partial' },
];

export function YesNoPartialPicker({ label, value, options = DEFAULT_OPTIONS, onChange }: YesNoPartialPickerProps) {
  return (
    <View style={{ marginBottom: 14 }}>
      {label && <Text style={{ fontSize: 13, color: '#374151', marginBottom: 4 }}>{label}</Text>}
      <View style={{ flexDirection: 'row', gap: 6 }}>
        {options.map((opt) => (
          <Pressable
            key={opt.value}
            onPress={() => onChange(opt.value)}
            style={{
              paddingHorizontal: 14,
              paddingVertical: 6,
              borderRadius: 16,
              backgroundColor: value === opt.value ? '#2563eb' : '#f3f4f6',
            }}
          >
            <Text style={{ fontSize: 13, color: value === opt.value ? '#fff' : '#4b5563' }}>{opt.label}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}
