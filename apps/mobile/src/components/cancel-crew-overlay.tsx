import { useCallback, useMemo, useRef, useState } from 'react';
import { View, Text, TextInput, Pressable, Alert } from 'react-native';
import BottomSheet, { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { apiPost } from '@/lib/api';

const REASONS = [
  { value: 'personal_reasons', label: 'Personal reasons' },
  { value: 'found_other_work', label: 'Found other work' },
  { value: 'unsafe_conditions', label: 'Unsafe conditions' },
  { value: 'other', label: 'Other' },
] as const;

interface Props {
  engagementId: string;
  onComplete: () => void;
  onDismiss: () => void;
}

export function CancelCrewOverlay({ engagementId, onComplete, onDismiss }: Props) {
  const ref = useRef<BottomSheet>(null);
  const snapPoints = useMemo(() => ['60%'], []);
  const [reason, setReason] = useState<string>('');
  const [freeText, setFreeText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = useCallback(async () => {
    if (!reason) { Alert.alert('Select a reason'); return; }
    setSubmitting(true);
    const result = await apiPost(`/api/engagements/${engagementId}/cancel-crew`, {
      reason, freeText: freeText.trim() || undefined,
    });
    setSubmitting(false);
    if (result.ok) onComplete();
    else Alert.alert('Error', result.error);
  }, [engagementId, reason, freeText, onComplete]);

  return (
    <BottomSheet ref={ref} snapPoints={snapPoints} enablePanDownToClose onClose={onDismiss} backgroundStyle={{ backgroundColor: '#fff' }} handleIndicatorStyle={{ backgroundColor: '#d1d5db' }}>
      <View style={{ paddingHorizontal: 16, paddingBottom: 8 }}>
        <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#111' }}>Cancel engagement</Text>
      </View>
      <BottomSheetScrollView contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>
        <Text style={{ fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 8 }}>Reason</Text>
        {REASONS.map((r) => (
          <Pressable key={r.value} onPress={() => setReason(r.value)} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10 }}>
            <View style={{ width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: reason === r.value ? '#2563eb' : '#d1d5db', marginRight: 10, alignItems: 'center', justifyContent: 'center' }}>
              {reason === r.value && <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: '#2563eb' }} />}
            </View>
            <Text style={{ fontSize: 14, color: '#111' }}>{r.label}</Text>
          </Pressable>
        ))}
        <TextInput value={freeText} onChangeText={(t) => setFreeText(t.slice(0, 250))} placeholder="Additional details..." multiline maxLength={250} style={{ borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, padding: 12, marginTop: 12, minHeight: 60, fontSize: 14, textAlignVertical: 'top' }} />
      </BottomSheetScrollView>
      <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: 16, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#e5e7eb' }}>
        <Pressable onPress={handleSubmit} disabled={submitting || !reason} style={{ backgroundColor: !reason ? '#d1d5db' : '#dc2626', borderRadius: 12, paddingVertical: 14, alignItems: 'center' }}>
          <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600' }}>{submitting ? 'Cancelling...' : 'Cancel engagement'}</Text>
        </Pressable>
      </View>
    </BottomSheet>
  );
}
