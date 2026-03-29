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
    <View style={{ marginBottom: 14 }}>
      <Text style={{ fontSize: 13, color: '#374151', marginBottom: 4 }}>{label}</Text>
      <View style={{ flexDirection: 'row', gap: 4 }}>
        {[1, 2, 3, 4, 5].map((star) => (
          <Pressable key={star} onPress={() => onChange(star)}>
            <Text style={{ fontSize: 28, color: star <= value ? '#f59e0b' : '#d1d5db' }}>★</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function BoolToggle({ label, value, onChange }: { label: string; value: boolean | null; onChange: (v: boolean) => void }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
      <Text style={{ fontSize: 13, color: '#374151', flex: 1 }}>{label}</Text>
      <View style={{ flexDirection: 'row', gap: 6 }}>
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

function ThreeWayPicker({ label, value, options, onChange }: { label: string; value: string | null; options: { value: string; label: string }[]; onChange: (v: string) => void }) {
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={{ fontSize: 13, color: '#374151', marginBottom: 4 }}>{label}</Text>
      <View style={{ flexDirection: 'row', gap: 6 }}>
        {options.map((opt) => (
          <Pressable key={opt.value} onPress={() => onChange(opt.value)} style={{ paddingHorizontal: 14, paddingVertical: 6, borderRadius: 16, backgroundColor: value === opt.value ? '#2563eb' : '#f3f4f6' }}>
            <Text style={{ fontSize: 13, color: value === opt.value ? '#fff' : '#4b5563' }}>{opt.label}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const YES_NO_PARTIAL = [{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }, { value: 'partial', label: 'Partial' }];
const DAYS_ACCURACY = [{ value: 'fewer', label: 'Fewer' }, { value: 'as_listed', label: 'As listed' }, { value: 'more', label: 'More' }];

export function RatingOverlay({ engagementId, isCrew, isCancelled, onComplete, onDismiss }: Props) {
  const ref = useRef<BottomSheet>(null);
  const snapPoints = useMemo(() => ['85%'], []);
  const [submitting, setSubmitting] = useState(false);

  const [communicationAccuracy, setCommunicationAccuracy] = useState<boolean | null>(null);
  const [overallMatch, setOverallMatch] = useState(0);

  const [noticeGiven, setNoticeGiven] = useState<string | null>(null);

  const [payAccuracy, setPayAccuracy] = useState<string | null>(null);
  const [mealsAccuracy, setMealsAccuracy] = useState<string | null>(null);
  const [roleAccuracy, setRoleAccuracy] = useState<string | null>(null);
  const [workingDaysAccuracy, setWorkingDaysAccuracy] = useState<string | null>(null);
  const [vesselCondition, setVesselCondition] = useState(0);
  const [wouldWorkAgain, setWouldWorkAgain] = useState<boolean | null>(null);

  const [skillsAsAdvertised, setSkillsAsAdvertised] = useState<string | null>(null);
  const [certificationsVerified, setCertificationsVerified] = useState<boolean | null>(null);
  const [punctuality, setPunctuality] = useState<string | null>(null);
  const [wouldRehire, setWouldRehire] = useState<boolean | null>(null);

  const handleSubmit = useCallback(async () => {
    if (communicationAccuracy === null || overallMatch === 0) {
      Alert.alert('Required', 'Communication accuracy and overall match are required');
      return;
    }

    const body: Record<string, unknown> = {
      communication_accuracy: communicationAccuracy,
      overall_match: overallMatch,
    };

    if (isCancelled && isCrew && noticeGiven) body.notice_given = noticeGiven;

    if (!isCancelled && isCrew) {
      body.pay_accuracy = payAccuracy;
      body.meals_accuracy = mealsAccuracy;
      body.role_accuracy = roleAccuracy;
      body.working_days_accuracy = workingDaysAccuracy;
      body.vessel_condition = vesselCondition;
      body.would_work_on_vessel_again = wouldWorkAgain;
    }

    if (!isCancelled && !isCrew) {
      body.skills_as_advertised = skillsAsAdvertised;
      body.certifications_verified = certificationsVerified;
      body.punctuality = punctuality;
      body.would_rehire = wouldRehire;
    }

    setSubmitting(true);
    const result = await apiPost(`/api/engagements/${engagementId}/rate`, body);
    setSubmitting(false);
    if (result.ok) onComplete();
    else Alert.alert('Error', result.error);
  }, [engagementId, isCrew, isCancelled, communicationAccuracy, overallMatch, noticeGiven, payAccuracy, mealsAccuracy, roleAccuracy, workingDaysAccuracy, vesselCondition, wouldWorkAgain, skillsAsAdvertised, certificationsVerified, punctuality, wouldRehire, onComplete]);

  return (
    <BottomSheet ref={ref} snapPoints={snapPoints} enablePanDownToClose onClose={onDismiss} backgroundStyle={{ backgroundColor: '#fff' }} handleIndicatorStyle={{ backgroundColor: '#d1d5db' }}>
      <View style={{ paddingHorizontal: 16, paddingBottom: 8 }}>
        <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#111' }}>Rate this engagement</Text>
      </View>
      <BottomSheetScrollView contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>
        <BoolToggle label="Was communication accurate?" value={communicationAccuracy} onChange={setCommunicationAccuracy} />
        <StarRow label="Overall match (1-5)" value={overallMatch} onChange={setOverallMatch} />

        {isCancelled && isCrew && (
          <ThreeWayPicker label="Was notice given?" value={noticeGiven} options={YES_NO_PARTIAL} onChange={setNoticeGiven} />
        )}

        {!isCancelled && isCrew && (
          <>
            <ThreeWayPicker label="Pay accuracy" value={payAccuracy} options={YES_NO_PARTIAL} onChange={setPayAccuracy} />
            <ThreeWayPicker label="Meals as described" value={mealsAccuracy} options={YES_NO_PARTIAL} onChange={setMealsAccuracy} />
            <ThreeWayPicker label="Role as described" value={roleAccuracy} options={YES_NO_PARTIAL} onChange={setRoleAccuracy} />
            <ThreeWayPicker label="Working days" value={workingDaysAccuracy} options={DAYS_ACCURACY} onChange={setWorkingDaysAccuracy} />
            <StarRow label="Vessel condition (1-5)" value={vesselCondition} onChange={setVesselCondition} />
            <BoolToggle label="Would work on this vessel again?" value={wouldWorkAgain} onChange={setWouldWorkAgain} />
          </>
        )}

        {!isCancelled && !isCrew && (
          <>
            <ThreeWayPicker label="Skills as advertised" value={skillsAsAdvertised} options={YES_NO_PARTIAL} onChange={setSkillsAsAdvertised} />
            <BoolToggle label="Certifications verified?" value={certificationsVerified} onChange={setCertificationsVerified} />
            <ThreeWayPicker label="Punctuality" value={punctuality} options={YES_NO_PARTIAL} onChange={setPunctuality} />
            <BoolToggle label="Would rehire?" value={wouldRehire} onChange={setWouldRehire} />
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
