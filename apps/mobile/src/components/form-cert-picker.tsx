import { useCallback, useMemo, useRef } from 'react';
import { View, Text, Pressable } from 'react-native';
import BottomSheet, { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { certsToGroups } from '@dockwalker/shared';
import { useCertifications } from '@/hooks/use-canonical';

interface FormCertPickerProps {
  value: string[];
  onChange: (certIds: string[]) => void;
  onDismiss: () => void;
}

export function FormCertPicker({ value, onChange, onDismiss }: FormCertPickerProps) {
  const bottomSheetRef = useRef<BottomSheet>(null);
  const snapPoints = useMemo(() => ['70%'], []);
  const { data: certs } = useCertifications();

  const groups = useMemo(() => certsToGroups(certs ?? []), [certs]);
  const selected = useMemo(() => new Set(value), [value]);

  const toggle = useCallback(
    (certId: string) => {
      const next = new Set(selected);
      if (next.has(certId)) next.delete(certId);
      else next.add(certId);
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
        <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#111' }}>Required certifications</Text>
        <Pressable onPress={onDismiss}>
          <Text style={{ fontSize: 14, color: '#2563eb', fontWeight: '600' }}>Done ({value.length})</Text>
        </Pressable>
      </View>

      <BottomSheetScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        {groups.map((group) => (
          <View key={group.id} style={{ marginBottom: 16 }}>
            <Text style={{ fontSize: 13, fontWeight: '600', color: '#6b7280', marginBottom: 6 }}>{group.label}</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {group.items.map((item) => {
                const isSelected = selected.has(item.id);
                return (
                  <Pressable
                    key={item.id}
                    onPress={() => toggle(item.id)}
                    style={{
                      paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16,
                      backgroundColor: isSelected ? '#2563eb' : '#f3f4f6',
                    }}
                  >
                    <Text style={{ fontSize: 13, color: isSelected ? '#fff' : '#4b5563' }}>
                      {item.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ))}
      </BottomSheetScrollView>
    </BottomSheet>
  );
}
