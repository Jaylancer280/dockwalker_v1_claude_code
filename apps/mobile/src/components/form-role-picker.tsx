import { useCallback, useMemo, useRef, useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import BottomSheet, { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { rolesToGroups } from '@dockwalker/shared';
import { useRoles } from '@/hooks/use-canonical';
import { colors } from '@/components/ui';

interface FormRolePickerProps {
  value: string | null;
  onChange: (roleId: string) => void;
  onDismiss: () => void;
}

export function FormRolePicker({ value, onChange, onDismiss }: FormRolePickerProps) {
  const bottomSheetRef = useRef<BottomSheet>(null);
  const snapPoints = useMemo(() => ['70%'], []);
  const { data: roles } = useRoles();
  const [expandedDept, setExpandedDept] = useState<string | null>(null);

  const groups = useMemo(() => rolesToGroups(roles ?? []), [roles]);

  const handleSelect = useCallback(
    (roleId: string) => {
      onChange(roleId);
      onDismiss();
    },
    [onChange, onDismiss],
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
      <View style={{ paddingHorizontal: 16, paddingBottom: 8 }}>
        <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#111' }}>Select role</Text>
      </View>

      <BottomSheetScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        {groups.map((group) => (
          <View key={group.id} style={{ marginBottom: 8 }}>
            <Pressable
              onPress={() => setExpandedDept(expandedDept === group.id ? null : group.id)}
              style={{ paddingVertical: 8, paddingHorizontal: 4 }}
            >
              <Text style={{ fontSize: 14, fontWeight: '600', color: '#374151' }}>
                {group.label} ({group.items.length})
              </Text>
            </Pressable>

            {expandedDept === group.id && (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingLeft: 4, paddingBottom: 8 }}>
                {group.items.map((item) => (
                  <Pressable
                    key={item.id}
                    onPress={() => handleSelect(item.id)}
                    style={{
                      paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16,
                      backgroundColor: item.id === value ? colors.primary : '#f3f4f6',
                    }}
                  >
                    <Text style={{ fontSize: 13, color: item.id === value ? '#fff' : '#4b5563' }}>
                      {item.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            )}
          </View>
        ))}
      </BottomSheetScrollView>
    </BottomSheet>
  );
}
