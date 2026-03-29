import { useCallback, useMemo, useRef } from 'react';
import { View, Text, Pressable } from 'react-native';
import BottomSheet, { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { LANGUAGES } from '@dockwalker/shared';
import { colors } from '@/components/ui';

interface FormLanguagePickerProps {
  value: string[];
  onChange: (langCodes: string[]) => void;
  onDismiss: () => void;
}

export function FormLanguagePicker({ value, onChange, onDismiss }: FormLanguagePickerProps) {
  const bottomSheetRef = useRef<BottomSheet>(null);
  const snapPoints = useMemo(() => ['60%'], []);
  const selected = useMemo(() => new Set(value), [value]);

  const toggle = useCallback(
    (code: string) => {
      const next = new Set(selected);
      if (next.has(code)) next.delete(code);
      else next.add(code);
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
        <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#111' }}>Required languages</Text>
        <Pressable onPress={onDismiss}>
          <Text style={{ fontSize: 14, color: colors.primary, fontWeight: '600' }}>Done ({value.length})</Text>
        </Pressable>
      </View>

      <BottomSheetScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {LANGUAGES.map((lang) => {
            const isSelected = selected.has(lang.code);
            return (
              <Pressable
                key={lang.code}
                onPress={() => toggle(lang.code)}
                style={{
                  paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16,
                  backgroundColor: isSelected ? colors.primary : '#f3f4f6',
                }}
              >
                <Text style={{ fontSize: 13, color: isSelected ? '#fff' : '#4b5563' }}>
                  {lang.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </BottomSheetScrollView>
    </BottomSheet>
  );
}
