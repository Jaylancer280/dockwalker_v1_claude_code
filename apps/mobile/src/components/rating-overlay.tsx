import { useCallback, useMemo, useRef, useState } from 'react';
import { View, Text, Alert } from 'react-native';
import BottomSheet, { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { apiPost } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { StarRating } from '@/components/ui/star-rating';
import { BoolToggle } from '@/components/ui/bool-toggle';
import { YesNoPartialPicker } from '@/components/ui/yes-no-partial-picker';

interface Props {
  engagementId: string;
  isCrew: boolean;
  isCancelled: boolean;
  onComplete: () => void;
  onDismiss: () => void;
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
        <StarRating label="Overall match (1-5)" value={overallMatch} onChange={setOverallMatch} />

        {isCancelled && isCrew && (
          <YesNoPartialPicker label="Was notice given?" value={noticeGiven} options={YES_NO_PARTIAL} onChange={setNoticeGiven} />
        )}

        {!isCancelled && isCrew && (
          <>
            <YesNoPartialPicker label="Pay accuracy" value={payAccuracy} options={YES_NO_PARTIAL} onChange={setPayAccuracy} />
            <YesNoPartialPicker label="Meals as described" value={mealsAccuracy} options={YES_NO_PARTIAL} onChange={setMealsAccuracy} />
            <YesNoPartialPicker label="Role as described" value={roleAccuracy} options={YES_NO_PARTIAL} onChange={setRoleAccuracy} />
            <YesNoPartialPicker label="Working days" value={workingDaysAccuracy} options={DAYS_ACCURACY} onChange={setWorkingDaysAccuracy} />
            <StarRating label="Vessel condition (1-5)" value={vesselCondition} onChange={setVesselCondition} />
            <BoolToggle label="Would work on this vessel again?" value={wouldWorkAgain} onChange={setWouldWorkAgain} />
          </>
        )}

        {!isCancelled && !isCrew && (
          <>
            <YesNoPartialPicker label="Skills as advertised" value={skillsAsAdvertised} options={YES_NO_PARTIAL} onChange={setSkillsAsAdvertised} />
            <BoolToggle label="Certifications verified?" value={certificationsVerified} onChange={setCertificationsVerified} />
            <YesNoPartialPicker label="Punctuality" value={punctuality} options={YES_NO_PARTIAL} onChange={setPunctuality} />
            <BoolToggle label="Would rehire?" value={wouldRehire} onChange={setWouldRehire} />
          </>
        )}
      </BottomSheetScrollView>
      <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: 16, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#e5e7eb' }}>
        <Button variant="primary" label={submitting ? 'Submitting...' : 'Submit rating'} loading={submitting} onPress={handleSubmit} />
      </View>
    </BottomSheet>
  );
}
