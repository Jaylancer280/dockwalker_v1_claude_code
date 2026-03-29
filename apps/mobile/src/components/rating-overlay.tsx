import { useCallback, useMemo, useRef, useState } from 'react';
import { View, Text, Pressable, Alert } from 'react-native';
import BottomSheet, { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { apiPost } from '@/lib/api';

interface Props {
  engagementId: string;
  isCrew: boolean;
  isCancelled: boolean;
  onComplete: () => void;
  onDismiss: () => void;
}

function StarRow({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={{ fontSize: 13, color: '#374151', marginBottom: 4 }}>{label}</Text>
      <View style={{ flexDirection: 'row', gap: 4 }}>
        {[1, 2, 3, 4, 5].map((star) => (
          <Pressable key={star} onPress={() => onChange(star)}>
            <Text style={{ fontSize: 24, color: star <= value ? '#f59e0b' : '#d1d5db' }}>★</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function BoolRow({ label, value, onChange }: { label: string; value: boolean | null; onChange: (v: boolean) => void }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
      <Text style={{ fontSize: 13, color: '#374151', flex: 1 }}>{label}</Text>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Pressable onPress={() => onChange(true)} style={{ paddingHorizontal: 14, paddingVertical: 6, borderRadius: 16, backgroundColor: value === true ? '#2563eb' : '#f3f4f6' }}>
          <Text style={{ fontSize: 13, color: value === true ? '#fff' : '#4b5563' }}>Yes</Text>
        </Pressable>
        <Pressable onPress={() => onChange(false)} style={{ paddingHorizontal: 14, paddingVertical: 6, borderRadius: 16, backgroundColor: value === false ? '#2563eb' : '#f3f4f6' }}>
          <Text style={{ fontSize: 13, color: value === false ? '#fff' : '#4b5563' }}>No</Text>
        </Pressable>
      </View>
    </View>
  );
}

export function RatingOverlay({ engagementId, isCrew, isCancelled, onComplete, onDismiss }: Props) {
  const ref = useRef<BottomSheet>(null);
  const snapPoints = useMemo(() => ['80%'], []);
  const [communication, setCommunication] = useState(0);
  const [overallMatch, setOverallMatch] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  // Crew-specific
  const [payAccuracy, setPayAccuracy] = useState(0);
  const [mealsRating, setMealsRating] = useState(0);
  const [roleMatch, setRoleMatch] = useState(0);
  const [wouldWorkAgain, setWouldWorkAgain] = useState<boolean | null>(null);

  // Employer-specific
  const [skillsMatch, setSkillsMatch] = useState(0);
  const [punctuality, setPunctuality] = useState(0);
  const [wouldRehire, setWouldRehire] = useState<boolean | null>(null);

  const handleSubmit = useCallback(async () => {
    if (communication === 0 || overallMatch === 0) {
      Alert.alert('Rate all fields', 'Communication and overall match are required');
      return;
    }

    setSubmitting(true);
    const body: Record<string, unknown> = { communication, overall_match: overallMatch };

    if (isCrew && !isCancelled) {
      body.pay_accuracy = payAccuracy;
      body.meals = mealsRating;
      body.role_match = roleMatch;
      body.would_work_again = wouldWorkAgain;
    } else if (!isCrew && !isCancelled) {
      body.skills_match = skillsMatch;
      body.punctuality = punctuality;
      body.would_rehire = wouldRehire;
    }

    const result = await apiPost(`/api/engagements/${engagementId}/rate`, body);
    setSubmitting(false);
    if (result.ok) onComplete();
    else Alert.alert('Error', result.error);
  }, [engagementId, isCrew, isCancelled, communication, overallMatch, payAccuracy, mealsRating, roleMatch, wouldWorkAgain, skillsMatch, punctuality, wouldRehire, onComplete]);

  return (
    <BottomSheet ref={ref} snapPoints={snapPoints} enablePanDownToClose onClose={onDismiss} backgroundStyle={{ backgroundColor: '#fff' }} handleIndicatorStyle={{ backgroundColor: '#d1d5db' }}>
      <View style={{ paddingHorizontal: 16, paddingBottom: 8 }}>
        <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#111' }}>Rate this engagement</Text>
      </View>
      <BottomSheetScrollView contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>
        <StarRow label="Communication" value={communication} onChange={setCommunication} />
        <StarRow label="Overall match" value={overallMatch} onChange={setOverallMatch} />

        {isCrew && !isCancelled && (
          <>
            <StarRow label="Pay accuracy" value={payAccuracy} onChange={setPayAccuracy} />
            <StarRow label="Meals quality" value={mealsRating} onChange={setMealsRating} />
            <StarRow label="Role match" value={roleMatch} onChange={setRoleMatch} />
            <BoolRow label="Would work again?" value={wouldWorkAgain} onChange={setWouldWorkAgain} />
          </>
        )}

        {!isCrew && !isCancelled && (
          <>
            <StarRow label="Skills match" value={skillsMatch} onChange={setSkillsMatch} />
            <StarRow label="Punctuality" value={punctuality} onChange={setPunctuality} />
            <BoolRow label="Would rehire?" value={wouldRehire} onChange={setWouldRehire} />
          </>
        )}
      </BottomSheetScrollView>
      <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: 16, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#e5e7eb' }}>
        <Pressable onPress={handleSubmit} disabled={submitting} style={{ backgroundColor: '#2563eb', borderRadius: 12, paddingVertical: 14, alignItems: 'center' }}>
          <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600' }}>{submitting ? 'Submitting...' : 'Submit rating'}</Text>
        </Pressable>
      </View>
    </BottomSheet>
  );
}
