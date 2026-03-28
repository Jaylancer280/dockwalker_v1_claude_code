import { useMemo, useRef } from 'react';
import { View, Text, Pressable } from 'react-native';
import BottomSheet, { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import type { DayworkTemplate, PermanentTemplate } from '@/hooks/use-templates';

type Template = DayworkTemplate | PermanentTemplate;

interface TemplateSelectorProps {
  templates: Template[];
  onSelect: (template: Template) => void;
  onDismiss: () => void;
  type: 'daywork' | 'permanent';
}

export function TemplateSelector({ templates, onSelect, onDismiss, type }: TemplateSelectorProps) {
  const bottomSheetRef = useRef<BottomSheet>(null);
  const snapPoints = useMemo(() => ['60%'], []);

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
        <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#111' }}>Load template</Text>
      </View>

      <BottomSheetScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        {templates.length === 0 ? (
          <View style={{ paddingTop: 40, alignItems: 'center' }}>
            <Text style={{ fontSize: 14, color: '#9ca3af' }}>No {type} templates saved</Text>
          </View>
        ) : (
          templates.map((t) => (
            <Pressable
              key={t.id}
              onPress={() => { onSelect(t); onDismiss(); }}
              style={{
                padding: 14, borderRadius: 10, borderWidth: 1, borderColor: '#e5e7eb',
                backgroundColor: '#fff', marginBottom: 8,
              }}
            >
              <Text style={{ fontSize: 15, fontWeight: '600', color: '#111' }}>{t.name}</Text>
              <Text style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
                {t.yacht_roles?.name ?? 'No role'} · {t.ports?.name ?? 'No location'}
              </Text>
            </Pressable>
          ))
        )}
      </BottomSheetScrollView>
    </BottomSheet>
  );
}
