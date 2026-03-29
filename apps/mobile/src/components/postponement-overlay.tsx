import { useCallback, useMemo, useRef, useState } from 'react';
import { View, Text, TextInput, Pressable, Alert, Platform } from 'react-native';
import BottomSheet, { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import DateTimePicker from '@react-native-community/datetimepicker';
import { apiPost } from '@/lib/api';
import { Button, SectionHeader } from '@/components/ui';

interface Props {
  engagementId: string;
  onComplete: () => void;
  onDismiss: () => void;
}

export function PostponementOverlay({ engagementId, onComplete, onDismiss }: Props) {
  const ref = useRef<BottomSheet>(null);
  const snapPoints = useMemo(() => ['65%'], []);
  const [startDate, setStartDate] = useState<Date>(new Date());
  const [endDate, setEndDate] = useState<Date>(new Date());
  const [workingDays, setWorkingDays] = useState('');
  const [showStart, setShowStart] = useState(false);
  const [showEnd, setShowEnd] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const fmt = (d: Date) => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

  const handleSubmit = useCallback(async () => {
    const dateSpan = Math.ceil((endDate.getTime() - startDate.getTime()) / 86_400_000) + 1;
    const days = workingDays.trim() ? parseInt(workingDays, 10) : dateSpan;
    if (!days || days <= 0) {
      Alert.alert('Invalid working days');
      return;
    }

    setSubmitting(true);
    const body: Record<string, unknown> = {
      start_date: startDate.toISOString().split('T')[0],
      end_date: endDate.toISOString().split('T')[0],
      working_days: days,
    };

    const result = await apiPost(`/api/engagements/${engagementId}/propose-postponement`, body);
    setSubmitting(false);

    if (result.ok) {
      onComplete();
    } else if (result.error.includes('conflict')) {
      Alert.alert('Scheduling conflict', 'The crew has a conflict with these dates. Proceed anyway?', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm anyway',
          onPress: async () => {
            setSubmitting(true);
            const r2 = await apiPost(`/api/engagements/${engagementId}/propose-postponement`, { ...body, confirm_conflict: true });
            setSubmitting(false);
            if (r2.ok) onComplete();
            else Alert.alert('Error', r2.error);
          },
        },
      ]);
    } else {
      Alert.alert('Error', result.error);
    }
  }, [engagementId, startDate, endDate, workingDays, onComplete]);

  return (
    <BottomSheet ref={ref} snapPoints={snapPoints} enablePanDownToClose onClose={onDismiss} backgroundStyle={{ backgroundColor: '#fff' }} handleIndicatorStyle={{ backgroundColor: '#d1d5db' }}>
      <View style={{ paddingHorizontal: 16, paddingBottom: 8 }}>
        <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#111' }}>Propose new dates</Text>
      </View>
      <BottomSheetScrollView contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>
        <SectionHeader title="New start date" />
        <Pressable onPress={() => setShowStart(true)} style={{ borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, padding: 12, marginBottom: 14 }}>
          <Text style={{ fontSize: 14, color: '#111' }}>{fmt(startDate)}</Text>
        </Pressable>
        {showStart && <DateTimePicker value={startDate} mode="date" minimumDate={new Date()} onChange={(_, d) => { setShowStart(Platform.OS === 'ios'); if (d) setStartDate(d); }} />}

        <SectionHeader title="New end date" />
        <Pressable onPress={() => setShowEnd(true)} style={{ borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, padding: 12, marginBottom: 14 }}>
          <Text style={{ fontSize: 14, color: '#111' }}>{fmt(endDate)}</Text>
        </Pressable>
        {showEnd && <DateTimePicker value={endDate} mode="date" minimumDate={startDate} onChange={(_, d) => { setShowEnd(Platform.OS === 'ios'); if (d) setEndDate(d); }} />}

        <SectionHeader title="Working days" />
        <TextInput value={workingDays} onChangeText={setWorkingDays} keyboardType="number-pad" placeholder="Auto-calculated from dates" style={{ borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, padding: 12, fontSize: 14 }} />
      </BottomSheetScrollView>
      <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: 16, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#e5e7eb' }}>
        <Button variant="primary" label={submitting ? 'Proposing...' : 'Propose dates'} loading={submitting} onPress={handleSubmit} />
      </View>
    </BottomSheet>
  );
}
