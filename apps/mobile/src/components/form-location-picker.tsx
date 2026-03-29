import { useCallback, useMemo, useRef, useState } from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import BottomSheet, { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { usePorts } from '@/hooks/use-canonical';
import { colors } from '@/components/ui';

interface FormLocationPickerProps {
  value: string | null;
  onChange: (portId: string) => void;
  onDismiss: () => void;
}

export function FormLocationPicker({ value, onChange, onDismiss }: FormLocationPickerProps) {
  const bottomSheetRef = useRef<BottomSheet>(null);
  const snapPoints = useMemo(() => ['70%'], []);
  const { data: portsData } = usePorts();
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null);
  const [selectedCity, setSelectedCity] = useState<string | null>(null);

  const regions = portsData?.regions ?? [];
  const citiesForRegion = useMemo(
    () => (portsData?.cities ?? []).filter((c) => c.region_id === selectedRegion),
    [portsData, selectedRegion],
  );
  const portsForCity = useMemo(
    () => (portsData?.ports ?? []).filter((p) => p.city_id === selectedCity),
    [portsData, selectedCity],
  );

  const handleSelectPort = useCallback(
    (portId: string) => {
      onChange(portId);
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
        <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#111' }}>Select location</Text>
        <Text style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>
          {selectedRegion && !selectedCity ? 'Select city' : selectedCity ? 'Select port/marina' : 'Select region'}
        </Text>
      </View>

      <BottomSheetScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        {/* Region level */}
        {!selectedRegion && (
          <View style={{ gap: 8 }}>
            {regions.map((r) => (
              <Pressable
                key={r.id}
                onPress={() => setSelectedRegion(r.id)}
                style={{ padding: 14, borderRadius: 10, backgroundColor: '#f3f4f6' }}
              >
                <Text style={{ fontSize: 15, fontWeight: '600', color: '#111' }}>{r.name}</Text>
              </Pressable>
            ))}
          </View>
        )}

        {/* City level */}
        {selectedRegion && !selectedCity && (
          <View>
            <Pressable onPress={() => setSelectedRegion(null)} style={{ marginBottom: 12 }}>
              <Text style={{ fontSize: 13, color: colors.primary }}>← Back to regions</Text>
            </Pressable>
            <View style={{ gap: 8 }}>
              {citiesForRegion.map((c) => (
                <Pressable
                  key={c.id}
                  onPress={() => setSelectedCity(c.id)}
                  style={{ padding: 14, borderRadius: 10, backgroundColor: '#f3f4f6' }}
                >
                  <Text style={{ fontSize: 15, fontWeight: '600', color: '#111' }}>{c.name}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        )}

        {/* Port level */}
        {selectedCity && (
          <View>
            <Pressable onPress={() => setSelectedCity(null)} style={{ marginBottom: 12 }}>
              <Text style={{ fontSize: 13, color: colors.primary }}>← Back to cities</Text>
            </Pressable>
            <View style={{ gap: 8 }}>
              {portsForCity.map((p) => (
                <Pressable
                  key={p.id}
                  onPress={() => handleSelectPort(p.id)}
                  style={{
                    padding: 14, borderRadius: 10, borderWidth: 2,
                    borderColor: p.id === value ? colors.primary : '#e5e7eb',
                    backgroundColor: p.id === value ? '#eff6ff' : '#fff',
                  }}
                >
                  <Text style={{ fontSize: 15, fontWeight: '600', color: '#111' }}>{p.name}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        )}
      </BottomSheetScrollView>
    </BottomSheet>
  );
}
