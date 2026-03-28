import { useCallback, useMemo, useRef, useState } from 'react';
import { View, Text, Pressable, Alert, ScrollView } from 'react-native';
import BottomSheet, { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { apiPost } from '@/lib/api';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/lib/auth-context';
import { usePorts } from '@/hooks/use-canonical';

interface AvailabilityOverlayProps {
  onDismiss: () => void;
  onAvailabilitySet: () => void;
}

function generateDates(count: number): string[] {
  const dates: string[] = [];
  const today = new Date();
  for (let i = 0; i < count; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() + i);
    dates.push(d.toISOString().split('T')[0]);
  }
  return dates;
}

function formatDate(dateStr: string): { day: string; weekday: string; month: string } {
  const d = new Date(dateStr + 'T00:00:00');
  return {
    day: String(d.getDate()),
    weekday: d.toLocaleDateString('en-GB', { weekday: 'short' }),
    month: d.toLocaleDateString('en-GB', { month: 'short' }),
  };
}

export function AvailabilityOverlay({ onDismiss, onAvailabilitySet }: AvailabilityOverlayProps) {
  const bottomSheetRef = useRef<BottomSheet>(null);
  const snapPoints = useMemo(() => ['85%'], []);
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { data: portsData } = usePorts();

  const allDates = useMemo(() => generateDates(14), []);
  const [selectedDates, setSelectedDates] = useState<Set<string>>(new Set());
  const [selectedCityId, setSelectedCityId] = useState<string | null>(null);
  const [selectedPortId, setSelectedPortId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Group cities by region for the picker
  const regionCities = useMemo(() => {
    if (!portsData) return [];
    const regionMap = new Map<string, { regionName: string; cities: { id: string; name: string }[] }>();
    for (const city of portsData.cities) {
      const regionName = city.regions.name;
      if (!regionMap.has(regionName)) {
        regionMap.set(regionName, { regionName, cities: [] });
      }
      regionMap.get(regionName)!.cities.push({ id: city.id, name: city.name });
    }
    return [...regionMap.values()];
  }, [portsData]);

  // Ports for the selected city
  const cityPorts = useMemo(() => {
    if (!portsData || !selectedCityId) return [];
    return portsData.ports.filter((p) => p.city_id === selectedCityId);
  }, [portsData, selectedCityId]);

  const selectedCityName = useMemo(() => {
    if (!portsData || !selectedCityId) return null;
    return portsData.cities.find((c) => c.id === selectedCityId)?.name ?? null;
  }, [portsData, selectedCityId]);

  const toggleDate = useCallback((date: string) => {
    setSelectedDates((prev) => {
      const next = new Set(prev);
      if (next.has(date)) next.delete(date);
      else next.add(date);
      return next;
    });
  }, []);

  const handleSelectCity = useCallback((cityId: string) => {
    setSelectedCityId(cityId);
    setSelectedPortId(null);
  }, []);

  const handleSubmit = useCallback(async () => {
    if (selectedDates.size === 0) {
      Alert.alert('Select dates', 'Pick at least one day you are available');
      return;
    }
    if (!selectedCityId) {
      Alert.alert('Select location', 'Pick the city where you are available');
      return;
    }

    setSubmitting(true);

    // Group contiguous dates into ranges
    const sorted = [...selectedDates].sort();
    const ranges: { startDate: string; endDate: string }[] = [];
    let rangeStart = sorted[0];
    let prev = sorted[0];

    for (let i = 1; i < sorted.length; i++) {
      const curr = sorted[i];
      const prevDate = new Date(prev + 'T00:00:00');
      const currDate = new Date(curr + 'T00:00:00');
      const diffDays = (currDate.getTime() - prevDate.getTime()) / 86_400_000;

      if (diffDays > 1) {
        ranges.push({ startDate: rangeStart, endDate: prev });
        rangeStart = curr;
      }
      prev = curr;
    }
    ranges.push({ startDate: rangeStart, endDate: prev });

    let failed = false;
    for (const range of ranges) {
      const body: Record<string, unknown> = {
        startDate: range.startDate,
        endDate: range.endDate,
        cityId: selectedCityId,
      };
      if (selectedPortId) body.portId = selectedPortId;

      const result = await apiPost('/api/availability', body);
      if (!result.ok) {
        Alert.alert('Error', result.error);
        failed = true;
        break;
      }
    }

    setSubmitting(false);

    if (!failed) {
      queryClient.invalidateQueries({ queryKey: ['availability', user?.id] });
      onAvailabilitySet();
    }
  }, [selectedDates, selectedCityId, selectedPortId, queryClient, user?.id, onAvailabilitySet]);

  const canSubmit = selectedDates.size > 0 && !!selectedCityId;

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
        <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#111' }}>Set your availability</Text>
        <Text style={{ fontSize: 13, color: '#6b7280', marginTop: 2 }}>
          Select your location and the days you are available
        </Text>
      </View>

      <BottomSheetScrollView contentContainerStyle={{ padding: 16, paddingBottom: 120 }}>
        {/* City picker */}
        <Text style={{ fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 8 }}>
          Where are you?
          {selectedCityName && (
            <Text style={{ fontWeight: '400', color: '#2563eb' }}> — {selectedCityName}</Text>
          )}
        </Text>

        {regionCities.map((region) => (
          <View key={region.regionName} style={{ marginBottom: 12 }}>
            <Text style={{ fontSize: 12, color: '#9ca3af', marginBottom: 4 }}>{region.regionName}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={{ flexDirection: 'row', gap: 6 }}>
                {region.cities.map((city) => (
                  <Pressable
                    key={city.id}
                    onPress={() => handleSelectCity(city.id)}
                    style={{
                      paddingHorizontal: 12,
                      paddingVertical: 6,
                      borderRadius: 16,
                      backgroundColor: city.id === selectedCityId ? '#2563eb' : '#f3f4f6',
                    }}
                  >
                    <Text style={{ fontSize: 13, color: city.id === selectedCityId ? '#fff' : '#4b5563' }}>
                      {city.name}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </ScrollView>
          </View>
        ))}

        {/* Optional port picker */}
        {cityPorts.length > 0 && (
          <View style={{ marginBottom: 16 }}>
            <Text style={{ fontSize: 12, color: '#9ca3af', marginBottom: 4 }}>Port/marina (optional)</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={{ flexDirection: 'row', gap: 6 }}>
                <Pressable
                  onPress={() => setSelectedPortId(null)}
                  style={{
                    paddingHorizontal: 12,
                    paddingVertical: 6,
                    borderRadius: 16,
                    backgroundColor: !selectedPortId ? '#2563eb' : '#f3f4f6',
                  }}
                >
                  <Text style={{ fontSize: 13, color: !selectedPortId ? '#fff' : '#4b5563' }}>Any</Text>
                </Pressable>
                {cityPorts.map((port) => (
                  <Pressable
                    key={port.id}
                    onPress={() => setSelectedPortId(port.id)}
                    style={{
                      paddingHorizontal: 12,
                      paddingVertical: 6,
                      borderRadius: 16,
                      backgroundColor: port.id === selectedPortId ? '#2563eb' : '#f3f4f6',
                    }}
                  >
                    <Text style={{ fontSize: 13, color: port.id === selectedPortId ? '#fff' : '#4b5563' }}>
                      {port.name}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </ScrollView>
          </View>
        )}

        {/* Date grid */}
        <Text style={{ fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 8, marginTop: 4 }}>
          Which days?
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {allDates.map((date) => {
            const { day, weekday, month } = formatDate(date);
            const selected = selectedDates.has(date);
            return (
              <Pressable
                key={date}
                onPress={() => toggleDate(date)}
                style={{
                  width: 60,
                  height: 72,
                  borderRadius: 10,
                  borderWidth: 2,
                  borderColor: selected ? '#2563eb' : '#e5e7eb',
                  backgroundColor: selected ? '#eff6ff' : '#fff',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text style={{ fontSize: 10, color: '#9ca3af' }}>{weekday}</Text>
                <Text style={{ fontSize: 20, fontWeight: 'bold', color: selected ? '#2563eb' : '#111' }}>
                  {day}
                </Text>
                <Text style={{ fontSize: 10, color: '#9ca3af' }}>{month}</Text>
              </Pressable>
            );
          })}
        </View>
      </BottomSheetScrollView>

      {/* Submit button */}
      <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: 16, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#e5e7eb' }}>
        <Pressable
          onPress={handleSubmit}
          disabled={submitting || !canSubmit}
          style={{
            backgroundColor: !canSubmit ? '#93c5fd' : '#2563eb',
            borderRadius: 12,
            paddingVertical: 14,
            alignItems: 'center',
          }}
        >
          <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600' }}>
            {submitting
              ? 'Setting...'
              : !selectedCityId
                ? 'Select a city first'
                : `Confirm ${selectedDates.size} day${selectedDates.size !== 1 ? 's' : ''}`}
          </Text>
        </Pressable>
      </View>
    </BottomSheet>
  );
}
