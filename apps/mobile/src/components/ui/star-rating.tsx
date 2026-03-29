import { View, Text, Pressable } from 'react-native';

interface StarRatingProps {
  label?: string;
  value: number;
  onChange: (v: number) => void;
}

export function StarRating({ label, value, onChange }: StarRatingProps) {
  return (
    <View style={{ marginBottom: 14 }}>
      {label && <Text style={{ fontSize: 13, color: '#374151', marginBottom: 4 }}>{label}</Text>}
      <View style={{ flexDirection: 'row', gap: 4 }}>
        {[1, 2, 3, 4, 5].map((star) => (
          <Pressable key={star} onPress={() => onChange(star)}>
            <Text style={{ fontSize: 28, color: star <= value ? '#f59e0b' : '#d1d5db' }}>★</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}
