import { useCallback, useMemo, useRef, useState } from 'react';
import { View, Text, Pressable, Alert } from 'react-native';
import BottomSheet, { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { apiPost } from '@/lib/api';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/lib/auth-context';

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
  const snapPoints = useMemo(() => ['80%'], []);
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const allDates = useMemo(() => generateDates(14), []);
  const [selectedDates, setSelectedDates] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);

  const toggleDate = useCallback((date: string) => {
    setSelectedDates((prev) => {
      const next = new Set(prev);
      if (next.has(date)) {
        next.delete(date);
      } else {
        next.add(date);
      }
      return next;
    });
  }, []);

  const handleSubmit = useCallback(async () => {
    if (selectedDates.size === 0) {
      Alert.alert('Select dates', 'Pick at least one day you are available');
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

    // Submit each range
    let failed = false;
    for (const range of ranges) {
      const result = await apiPost('/api/availability', {
        startDate: range.startDate,
        endDate: range.endDate,
      });
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
  }, [selectedDates, queryClient, user?.id, onAvailabilitySet]);

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
          You need to set availability before applying to daywork
        </Text>
      </View>

      <BottomSheetScrollView contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>
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
          disabled={submitting || selectedDates.size === 0}
          style={{
            backgroundColor: selectedDates.size === 0 ? '#93c5fd' : '#2563eb',
            borderRadius: 12,
            paddingVertical: 14,
            alignItems: 'center',
          }}
        >
          <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600' }}>
            {submitting ? 'Setting...' : `Confirm ${selectedDates.size} day${selectedDates.size !== 1 ? 's' : ''}`}
          </Text>
        </Pressable>
      </View>
    </BottomSheet>
  );
}
