import { useMemo, useRef, useState } from 'react';
import { View, Text, TextInput, Pressable } from 'react-native';
import BottomSheet, { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { useNationalities } from '@/hooks/use-canonical';
import { colors } from '@/components/ui';

interface FormNationalityPickerProps {
  value: string | null;
  onChange: (nationalityId: string | null) => void;
  onDismiss: () => void;
}

export function FormNationalityPicker({ value, onChange, onDismiss }: FormNationalityPickerProps) {
  const bottomSheetRef = useRef<BottomSheet>(null);
  const snapPoints = useMemo(() => ['70%'], []);
  const { data: nationalities } = useNationalities();
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const items = nationalities ?? [];
    if (!search.trim()) return items;
    const q = search.toLowerCase();
    return items.filter((n) => n.name.toLowerCase().includes(q));
  }, [nationalities, search]);

  return (
    <BottomSheet
      ref={bottomSheetRef}
      snapPoints={snapPoints}
      enablePanDownToClose
      onClose={onDismiss}
      backgroundStyle={{ backgroundColor: '#fff' }}
      handleIndicatorStyle={{ backgroundColor: '#d1d5db' }}
    >
      <View style={{ paddingHorizontal: 16, paddingBottom: 8 }}>
        <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#111' }}>Nationality</Text>
      </View>

      <View style={{ paddingHorizontal: 16, paddingBottom: 8 }}>
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search..."
          placeholderTextColor="#9ca3af"
          style={{ borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, padding: 10, fontSize: 14 }}
        />
      </View>

      <BottomSheetScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        <Pressable
          onPress={() => { onChange(null); onDismiss(); }}
          style={{ paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' }}
        >
          <Text style={{ fontSize: 14, color: !value ? colors.primary : '#6b7280', fontWeight: !value ? '600' : '400' }}>
            Not specified
          </Text>
        </Pressable>
        {filtered.map((n) => {
          const selected = n.id === value;
          return (
            <Pressable
              key={n.id}
              onPress={() => { onChange(n.id); onDismiss(); }}
              style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' }}
            >
              <Text style={{ fontSize: 18, marginRight: 10 }}>{n.flag_emoji}</Text>
              <Text style={{ fontSize: 14, color: selected ? colors.primary : '#111', fontWeight: selected ? '600' : '400', flex: 1 }}>
                {n.name}
              </Text>
              {selected && <Text style={{ color: colors.primary, fontWeight: 'bold' }}>✓</Text>}
            </Pressable>
          );
        })}
      </BottomSheetScrollView>
    </BottomSheet>
  );
}
