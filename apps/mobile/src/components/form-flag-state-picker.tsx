import { useMemo, useRef, useState } from 'react';
import { View, Text, TextInput, Pressable } from 'react-native';
import BottomSheet, { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { useFlagStates } from '@/hooks/use-canonical';
import { colors } from '@/components/ui';

interface FormFlagStatePickerProps {
  value: string | null;
  onChange: (flagState: string | null) => void;
  onDismiss: () => void;
}

export function FormFlagStatePicker({ value, onChange, onDismiss }: FormFlagStatePickerProps) {
  const bottomSheetRef = useRef<BottomSheet>(null);
  const snapPoints = useMemo(() => ['60%'], []);
  const { data: flagStates } = useFlagStates();
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const items = flagStates ?? [];
    if (!search.trim()) return items;
    const q = search.toLowerCase();
    return items.filter((f) => f.name.toLowerCase().includes(q));
  }, [flagStates, search]);

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
        <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#111' }}>Flag state</Text>
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
        {filtered.map((f) => {
          const selected = f.name === value;
          return (
            <Pressable
              key={f.id}
              onPress={() => { onChange(f.name); onDismiss(); }}
              style={{ paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' }}
            >
              <Text style={{ fontSize: 14, color: selected ? colors.primary : '#111', fontWeight: selected ? '600' : '400' }}>
                {f.name}
              </Text>
            </Pressable>
          );
        })}
      </BottomSheetScrollView>
    </BottomSheet>
  );
}
