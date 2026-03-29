import { useState, useCallback, useEffect } from 'react';
import { View, Text, Pressable, ScrollView, Alert, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as Haptics from 'expo-haptics';
import { useAuth } from '@/lib/auth-context';
import { useProfile } from '@/hooks/use-profile';
import { useExperiences } from '@/hooks/use-experiences';
import { apiGet, apiPost } from '@/lib/api';
import { VesselSelector } from '@/components/vessel-selector';
import { FormRolePicker } from '@/components/form-role-picker';
import { FormFlagStatePicker } from '@/components/form-flag-state-picker';
import { Button, FormInput, SectionHeader, ScreenHeader, Pill, Card, colors } from '@/components/ui';

const CONTRACT_TYPES = ['permanent', 'rotational', 'seasonal', 'crossing', 'delivery', 'temporary'] as const;
const CURRENCIES = ['EUR', 'USD', 'GBP', 'AED'] as const;
const SALARY_PERIODS = ['daily', 'monthly', 'annually'] as const;

export default function AddExperienceScreen() {
  const { person } = useAuth();
  const { invalidate: invalidateProfile } = useProfile();
  const { invalidate: invalidateExperiences } = useExperiences();
  const isAgent = person?.identity_type === 'agent';

  const [vesselId, setVesselId] = useState<string | null>(null);
  const [roleId, setRoleId] = useState<string | null>(null);
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [isCurrent, setIsCurrent] = useState(false);
  const [vesselOperation, setVesselOperation] = useState<string | null>(null);
  const [flagState, setFlagState] = useState<string | null>(null);
  const [contractType, setContractType] = useState<string | null>(null);
  const [contractDetails, setContractDetails] = useState('');
  const [description, setDescription] = useState('');
  const [seaTimeDays, setSeaTimeDays] = useState('');
  const [seaTimeNm, setSeaTimeNm] = useState('');
  const [salaryAmount, setSalaryAmount] = useState('');
  const [salaryCurrency, setSalaryCurrency] = useState('EUR');
  const [salaryPeriod, setSalaryPeriod] = useState('monthly');
  const [submitting, setSubmitting] = useState(false);

  // Picker visibility
  const [showVessel, setShowVessel] = useState(false);
  const [showRole, setShowRole] = useState(false);
  const [showStartDate, setShowStartDate] = useState(false);
  const [showEndDate, setShowEndDate] = useState(false);
  const [showFlagState, setShowFlagState] = useState(false);

  const fmt = (d: Date | null) => d ? d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Select';

  const handleSubmit = useCallback(async () => {
    if (!vesselId || !roleId || !startDate || !vesselOperation) {
      Alert.alert('Missing fields', 'Vessel, role, start date, and vessel operation are required');
      return;
    }
    if (isAgent && !endDate) {
      Alert.alert('Missing fields', 'End date is required for agents');
      return;
    }
    if (endDate && endDate < startDate) {
      Alert.alert('Invalid dates', 'End date must be after start date');
      return;
    }

    setSubmitting(true);
    const body: Record<string, unknown> = {
      vesselId,
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
    if (seaTimeDays) body.seaTimeDays = parseInt(seaTimeDays, 10);
    if (seaTimeNm) body.seaTimeNauticalMiles = parseInt(seaTimeNm, 10);
    if (salaryAmount) {
      body.salaryAmount = parseFloat(salaryAmount);
      body.salaryCurrency = salaryCurrency;
      body.salaryPeriod = salaryPeriod;
    }

    const result = await apiPost('/api/experiences', body);
    setSubmitting(false);

    if (result.ok) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await Promise.all([invalidateExperiences(), invalidateProfile()]);
      router.back();
    } else {
      Alert.alert('Error', result.error);
    }
  }, [vesselId, roleId, startDate, endDate, isCurrent, vesselOperation, flagState, contractType, contractDetails, description, seaTimeDays, seaTimeNm, salaryAmount, salaryCurrency, salaryPeriod, isAgent, invalidateExperiences, invalidateProfile]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f9fafb' }}>
      <ScreenHeader title="Add Experience" onBack={() => router.back()} />

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>
        {/* Vessel */}
        <SectionHeader title="Vessel *" />
        <Pressable onPress={() => setShowVessel(true)} style={{ borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, padding: 12, marginBottom: 14 }}>
          <Text style={{ color: vesselId ? '#111' : '#9ca3af' }}>{vesselId ? 'Vessel selected' : 'Search by IMO or select'}</Text>
        </Pressable>

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

        {/* Contract details (non-permanent) */}
        {contractType && contractType !== 'permanent' && (
          <FormInput label="Contract details" value={contractDetails} onChangeText={setContractDetails} maxLength={100} placeholder="Rotation, schedule..." />
        )}

        {/* Description */}
        <FormInput label="Description" value={description} onChangeText={setDescription} maxLength={250} multiline placeholder="What you did..." style={{ minHeight: 60, textAlignVertical: 'top' }} />

        {/* Sea time */}
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <View style={{ flex: 1 }}>
            <FormInput label="Sea time (days)" value={seaTimeDays} onChangeText={setSeaTimeDays} keyboardType="number-pad" placeholder="0" />
          </View>
          <View style={{ flex: 1 }}>
            <FormInput label="Sea time (NM)" value={seaTimeNm} onChangeText={setSeaTimeNm} keyboardType="number-pad" placeholder="0" />
          </View>
        </View>

        {/* Salary (private) */}
        <View style={{ marginTop: 8, marginBottom: 14 }}>
          <SectionHeader title="Salary" subtitle="Private — not shown to employers" />
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <View style={{ flex: 1 }}>
              <FormInput value={salaryAmount} onChangeText={setSalaryAmount} keyboardType="decimal-pad" placeholder="Amount" />
            </View>
          </View>
          <View style={{ flexDirection: 'row', gap: 6, marginBottom: 8 }}>
            {CURRENCIES.map((c) => (
              <Pill key={c} label={c} selected={salaryCurrency === c} onPress={() => setSalaryCurrency(c)} />
            ))}
          </View>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            {SALARY_PERIODS.map((p) => (
              <Pill key={p} label={p} selected={salaryPeriod === p} onPress={() => setSalaryPeriod(p)} />
            ))}
          </View>
        </View>

        <View style={{ marginTop: 8 }}>
          <Button variant="primary" label={submitting ? 'Adding...' : 'Add experience'} loading={submitting} onPress={handleSubmit} />
        </View>
      </ScrollView>

      {/* Pickers */}
      {showVessel && <VesselSelector value={vesselId} onChange={(id) => { setVesselId(id); setShowVessel(false); }} onDismiss={() => setShowVessel(false)} />}
      {showRole && <FormRolePicker value={roleId} onChange={(id) => { setRoleId(id); setShowRole(false); }} onDismiss={() => setShowRole(false)} />}
      {showFlagState && <FormFlagStatePicker value={flagState} onChange={(v) => { setFlagState(v); }} onDismiss={() => setShowFlagState(false)} />}
    </SafeAreaView>
  );
}
