import { useState, useCallback, useMemo } from 'react';
import { View, Text, Pressable, ScrollView, Alert, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as Haptics from 'expo-haptics';
import { useAuth } from '@/lib/auth-context';
import { useProfile } from '@/hooks/use-profile';
import { useExperiences } from '@/hooks/use-experiences';
import { apiPatch, apiDelete } from '@/lib/api';
import { FormRolePicker } from '@/components/form-role-picker';
import { FormFlagStatePicker } from '@/components/form-flag-state-picker';
import { Button, FormInput, SectionHeader, ScreenHeader, Pill, colors } from '@/components/ui';

const CONTRACT_TYPES = ['permanent', 'rotational', 'seasonal', 'crossing', 'delivery', 'temporary'] as const;
const CURRENCIES = ['EUR', 'USD', 'GBP', 'AED'] as const;
const SALARY_PERIODS = ['daily', 'monthly', 'annually'] as const;

export default function EditExperienceScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { person } = useAuth();
  const { invalidate: invalidateProfile } = useProfile();
  const { data: experiencesData, invalidate: invalidateExperiences } = useExperiences();
  const isAgent = person?.identity_type === 'agent';

  const experience = useMemo(
    () => experiencesData?.experiences.find((e) => e.id === id),
    [experiencesData, id],
  );

  const [roleId, setRoleId] = useState<string | null>(experience?.role_id ?? null);
  const [startDate, setStartDate] = useState<Date | null>(experience?.start_date ? new Date(experience.start_date) : null);
  const [endDate, setEndDate] = useState<Date | null>(experience?.end_date ? new Date(experience.end_date) : null);
  const [isCurrent, setIsCurrent] = useState(experience?.is_current ?? false);
  const [vesselOperation, setVesselOperation] = useState<string | null>(experience?.vessel_operation ?? null);
  const [flagState, setFlagState] = useState<string | null>(experience?.flag_state ?? null);
  const [contractType, setContractType] = useState<string | null>(experience?.contract_type ?? null);
  const [contractDetails, setContractDetails] = useState(experience?.contract_details ?? '');
  const [description, setDescription] = useState(experience?.description ?? '');
  const [submitting, setSubmitting] = useState(false);

  const [showRole, setShowRole] = useState(false);
  const [showStartDate, setShowStartDate] = useState(false);
  const [showEndDate, setShowEndDate] = useState(false);
  const [showFlagState, setShowFlagState] = useState(false);

  const fmt = (d: Date | null) => d ? d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Select';

  const handleSave = useCallback(async () => {
    if (!roleId || !startDate || !vesselOperation) {
      Alert.alert('Missing fields', 'Role, start date, and vessel operation are required');
      return;
    }

    setSubmitting(true);
    const body: Record<string, unknown> = {
      roleId,
      startDate: startDate.toISOString().split('T')[0],
      vesselOperation,
      isCurrent: isAgent ? false : isCurrent,
    };
    if (endDate) body.endDate = endDate.toISOString().split('T')[0];
    if (flagState) body.flagState = flagState;
    if (contractType) body.contractType = contractType;
    if (contractDetails.trim()) body.contractDetails = contractDetails.trim();
    if (description.trim()) body.description = description.trim();

    const result = await apiPatch(`/api/experiences/${id}`, body);
    setSubmitting(false);

    if (result.ok) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await Promise.all([invalidateExperiences(), invalidateProfile()]);
      router.back();
    } else {
      Alert.alert('Error', result.error);
    }
  }, [id, roleId, startDate, endDate, isCurrent, vesselOperation, flagState, contractType, contractDetails, description, isAgent, invalidateExperiences, invalidateProfile]);

  const handleDelete = useCallback(() => {
    Alert.alert(
      'Delete experience?',
      'This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const result = await apiDelete(`/api/experiences/${id}`);
            if (result.ok) {
              await Promise.all([invalidateExperiences(), invalidateProfile()]);
              router.back();
            } else {
              Alert.alert('Error', result.error);
            }
          },
        },
      ],
    );
  }, [id, invalidateExperiences, invalidateProfile]);

  if (!experience) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#f9fafb' }}>
        <ScreenHeader title="Edit Experience" onBack={() => router.back()} />
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <Text style={{ color: '#9ca3af' }}>Experience not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  const vessel = experience.vessels;
  const prefix = vessel.vessel_type === 'motor' ? 'M/Y' : 'S/Y';

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f9fafb' }}>
      <ScreenHeader title="Edit Experience" onBack={() => router.back()} />

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>
        {/* Vessel (read-only) */}
        <SectionHeader title="Vessel" />
        <View style={{ borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 8, padding: 12, marginBottom: 14, backgroundColor: '#f9fafb' }}>
          <Text style={{ fontSize: 14, color: '#6b7280' }}>{prefix} {vessel.name} (IMO {vessel.imo_number})</Text>
        </View>

        {/* Role */}
        <SectionHeader title="Role *" />
        <Pressable onPress={() => setShowRole(true)} style={{ borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, padding: 12, marginBottom: 14 }}>
          <Text style={{ color: roleId ? '#111' : '#9ca3af' }}>{roleId ? 'Role selected' : 'Select role'}</Text>
        </Pressable>

        {/* Start date */}
        <SectionHeader title="Start date *" />
        <Pressable onPress={() => setShowStartDate(true)} style={{ borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, padding: 12, marginBottom: 14 }}>
          <Text style={{ color: startDate ? '#111' : '#9ca3af' }}>{fmt(startDate)}</Text>
        </Pressable>
        {showStartDate && (
          <DateTimePicker value={startDate ?? new Date()} mode="date" onChange={(_, d) => { setShowStartDate(Platform.OS === 'ios'); if (d) setStartDate(d); }} />
        )}

        {/* End date */}
        {!isCurrent && (
          <>
            <SectionHeader title={`End date${isAgent ? ' *' : ''}`} />
            <Pressable onPress={() => setShowEndDate(true)} style={{ borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, padding: 12, marginBottom: 14 }}>
              <Text style={{ color: endDate ? '#111' : '#9ca3af' }}>{fmt(endDate)}</Text>
            </Pressable>
            {showEndDate && (
              <DateTimePicker value={endDate ?? startDate ?? new Date()} mode="date" onChange={(_, d) => { setShowEndDate(Platform.OS === 'ios'); if (d) setEndDate(d); }} />
            )}
          </>
        )}

        {/* Is current */}
        {!isAgent && (
          <>
            <SectionHeader title="Current position" />
            <View style={{ flexDirection: 'row', gap: 6, marginBottom: 14 }}>
              <Pill label="Yes" selected={isCurrent} onPress={() => { setIsCurrent(true); setEndDate(null); }} />
              <Pill label="No" selected={!isCurrent} onPress={() => setIsCurrent(false)} />
            </View>
          </>
        )}

        {/* Vessel operation */}
        <SectionHeader title="Vessel operation *" />
        <View style={{ flexDirection: 'row', gap: 6, marginBottom: 14 }}>
          <Pill label="Charter" selected={vesselOperation === 'charter'} onPress={() => setVesselOperation('charter')} />
          <Pill label="Private" selected={vesselOperation === 'private'} onPress={() => setVesselOperation('private')} />
        </View>

        {/* Flag state */}
        <SectionHeader title="Flag state" />
        <Pressable onPress={() => setShowFlagState(true)} style={{ borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, padding: 12, marginBottom: 14 }}>
          <Text style={{ color: flagState ? '#111' : '#9ca3af' }}>{flagState ?? 'Select flag state'}</Text>
        </Pressable>

        {/* Contract type */}
        <SectionHeader title="Contract type" />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            {CONTRACT_TYPES.map((ct) => (
              <Pill key={ct} label={ct} selected={contractType === ct} onPress={() => setContractType(contractType === ct ? null : ct)} />
            ))}
          </View>
        </ScrollView>

        {contractType && contractType !== 'permanent' && (
          <FormInput label="Contract details" value={contractDetails} onChangeText={setContractDetails} maxLength={100} placeholder="Rotation, schedule..." />
        )}

        <FormInput label="Description" value={description} onChangeText={setDescription} maxLength={250} multiline placeholder="What you did..." style={{ minHeight: 60, textAlignVertical: 'top' }} />

        <View style={{ marginTop: 8, gap: 10 }}>
          <Button variant="primary" label={submitting ? 'Saving...' : 'Save changes'} loading={submitting} onPress={handleSave} />
          <Button variant="destructive" label="Delete experience" onPress={handleDelete} />
        </View>
      </ScrollView>

      {showRole && <FormRolePicker value={roleId} onChange={(rid) => { setRoleId(rid); setShowRole(false); }} onDismiss={() => setShowRole(false)} />}
      {showFlagState && <FormFlagStatePicker value={flagState} onChange={(v) => { setFlagState(v); }} onDismiss={() => setShowFlagState(false)} />}
    </SafeAreaView>
  );
}
