import { useCallback, useMemo, useRef } from 'react';
import { View, Text, Pressable } from 'react-native';
import BottomSheet, { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { useVisaTypes } from '@/hooks/use-canonical';
import { Pill, colors } from '@/components/ui';

interface FormVisaPickerProps {
  value: string[];
  onChange: (visaIds: string[]) => void;
  onDismiss: () => void;
}

export function FormVisaPicker({ value, onChange, onDismiss }: FormVisaPickerProps) {
  const bottomSheetRef = useRef<BottomSheet>(null);
  const snapPoints = useMemo(() => ['50%'], []);
  const { data: visaTypes } = useVisaTypes();
  const selected = useMemo(() => new Set(value), [value]);

  const toggle = useCallback(
    (visaId: string) => {
      const next = new Set(selected);
      if (next.has(visaId)) next.delete(visaId);
      else next.add(visaId);
      onChange([...next]);
    },
    [selected, onChange],
  );

  return (
    <BottomSheet
      ref={bottomSheetRef}
      snapPoints={snapPoints}
      enablePanDownToClose
      onClose={onDismiss}
      backgroundStyle={{ backgroundColor: '#fff' }}
      handleIndicatorStyle={{ backgroundColor: '#d1d5db' }}
    >
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 8 }}>
        <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#111' }}>Visas</Text>
        <Pressable onPress={onDismiss}>
          <Text style={{ fontSize: 14, color: colors.primary, fontWeight: '600' }}>Done ({value.length})</Text>
        </Pressable>
      </View>

      <BottomSheetScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {(visaTypes ?? []).map((v) => (
            <Pill
              key={v.id}
              label={v.name}
              selected={selected.has(v.id)}
              onPress={() => toggle(v.id)}
            />
          ))}
        </View>
      </BottomSheetScrollView>
    </BottomSheet>
  );
}
