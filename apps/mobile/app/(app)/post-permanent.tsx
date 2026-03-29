import { useState, useCallback } from 'react';
import { View, Text, TextInput, Pressable, Alert, Switch, ScrollView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, Redirect } from 'expo-router';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as Haptics from 'expo-haptics';
import { apiPost } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { useExperienceBrackets } from '@/hooks/use-canonical';
import { VesselSelector } from '@/components/vessel-selector';
import { FormRolePicker } from '@/components/form-role-picker';
import { FormLocationPicker } from '@/components/form-location-picker';
import { FormCertPicker } from '@/components/form-cert-picker';
import { FormLanguagePicker } from '@/components/form-language-picker';
import { Button, Pill, SectionHeader, FormInput, ScreenHeader, colors } from '@/components/ui';

const CURRENCIES = ['EUR', 'USD', 'GBP', 'AED'] as const;
const PERIODS = ['monthly', 'annual'] as const;
const MEAL_OPTIONS = ['breakfast', 'lunch', 'dinner'] as const;
const CONTRACT_TYPES = ['permanent', 'rotational', 'seasonal', 'crossing', 'delivery', 'temporary'] as const;

export default function PostPermanentScreen() {
  const { person } = useAuth();
  const { data: brackets } = useExperienceBrackets();

  if (person?.current_hat === 'crew') return <Redirect href="/(app)/(tabs)/discover" />;

  const [vesselId, setVesselId] = useState<string | null>(null);
  const [roleId, setRoleId] = useState<string | null>(null);
  const [portId, setPortId] = useState<string | null>(null);
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [salaryMin, setSalaryMin] = useState('');
  const [salaryMax, setSalaryMax] = useState('');
  const [salaryCurrency, setSalaryCurrency] = useState('EUR');
  const [salaryPeriod, setSalaryPeriod] = useState<string>('monthly');
  const [liveAboard, setLiveAboard] = useState(false);
  const [certIds, setCertIds] = useState<string[]>([]);
  const [langCodes, setLangCodes] = useState<string[]>([]);
  const [bracketId, setBracketId] = useState<string | null>(null);
  const [shortlistCap, setShortlistCap] = useState('5');
  const [contractType, setContractType] = useState<string>('permanent');
  const [contractDetails, setContractDetails] = useState('');
  const [description, setDescription] = useState('');
  const [meals, setMeals] = useState<string[]>([]);
  const [positions, setPositions] = useState('1');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [showVessel, setShowVessel] = useState(false);
  const [showRole, setShowRole] = useState(false);
  const [showLocation, setShowLocation] = useState(false);
  const [showCerts, setShowCerts] = useState(false);
  const [showLangs, setShowLangs] = useState(false);
  const [showStartDate, setShowStartDate] = useState(false);

  const toggleMeal = useCallback((meal: string) => {
    setMeals((prev) => prev.includes(meal) ? prev.filter((m) => m !== meal) : [...prev, meal]);
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!vesselId || !roleId || !portId || !startDate || !salaryMin || !salaryMax) {
      Alert.alert('Missing fields', 'Vessel, role, location, start date, and salary are required');
      return;
    }
    const min = parseFloat(salaryMin);
    const max = parseFloat(salaryMax);
    if (isNaN(min) || min <= 0 || isNaN(max) || max <= 0) {
      Alert.alert('Invalid salary', 'Enter valid salary amounts');
      return;
    }
    if (max < min) {
      Alert.alert('Invalid salary', 'Maximum salary must be at least the minimum');
      return;
    }

    setSubmitting(true);
    const body: Record<string, unknown> = {
      vesselId,
      roleId,
      locationPortId: portId,
      startDate: startDate.toISOString().split('T')[0],
      salaryMin: min,
      salaryMax: max,
      salaryCurrency,
      salaryPeriod,
      liveAboard,
      shortlistCap: parseInt(shortlistCap, 10) || 5,
      contractType,
      meals,
      positionsAvailable: parseInt(positions, 10) || 1,
      notes: notes.trim() || undefined,
      description: description.trim() || undefined,
    };
    if (contractType !== 'permanent' && contractDetails.trim()) {
      body.contractDetails = contractDetails.trim();
    }
    if (certIds.length > 0) body.requiredCertificationIds = certIds;
    if (langCodes.length > 0) body.requiredLanguages = langCodes;
    if (bracketId) body.experienceBracketId = bracketId;

    const result = await apiPost('/api/permanent', body);
    setSubmitting(false);

    if (result.ok) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace('/(app)/(tabs)/my-jobs');
    } else {
      Alert.alert('Failed to post', result.error);
    }
  }, [vesselId, roleId, portId, startDate, salaryMin, salaryMax, salaryCurrency, salaryPeriod, liveAboard, certIds, langCodes, bracketId, shortlistCap, contractType, contractDetails, description, meals, positions, notes]);

  const fmt = (d: Date | null) => d ? d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Select';

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f9fafb' }}>
      <ScreenHeader title="Post Permanent" onBack={() => router.back()} />

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>
        {/* Vessel */}
        <SectionHeader title="Vessel *" />
        <Pressable onPress={() => setShowVessel(true)} style={{ borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, padding: 12, marginBottom: 14 }}>
          <Text style={{ color: vesselId ? '#111' : '#9ca3af' }}>{vesselId ? 'Vessel selected' : 'Select vessel'}</Text>
        </Pressable>

        {/* Role */}
        <SectionHeader title="Role *" />
        <Pressable onPress={() => setShowRole(true)} style={{ borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, padding: 12, marginBottom: 14 }}>
          <Text style={{ color: roleId ? '#111' : '#9ca3af' }}>{roleId ? 'Role selected' : 'Select role'}</Text>
        </Pressable>

        {/* Location */}
        <SectionHeader title="Location *" />
        <Pressable onPress={() => setShowLocation(true)} style={{ borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, padding: 12, marginBottom: 14 }}>
          <Text style={{ color: portId ? '#111' : '#9ca3af' }}>{portId ? 'Location selected' : 'Select port/marina'}</Text>
        </Pressable>

        {/* Start date */}
        <SectionHeader title="Start date *" />
        <Pressable onPress={() => setShowStartDate(true)} style={{ borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, padding: 12, marginBottom: 14 }}>
          <Text style={{ color: startDate ? '#111' : '#9ca3af' }}>{fmt(startDate)}</Text>
        </Pressable>
        {showStartDate && (
          <DateTimePicker value={startDate ?? new Date()} mode="date" onChange={(_, d) => { setShowStartDate(Platform.OS === 'ios'); if (d) setStartDate(d); }} />
        )}

        {/* Salary */}
        <SectionHeader title="Salary range *" />
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
          <TextInput value={salaryMin} onChangeText={setSalaryMin} keyboardType="decimal-pad" placeholder="Min" style={{ flex: 1, borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, padding: 12, fontSize: 14 }} />
          <TextInput value={salaryMax} onChangeText={setSalaryMax} keyboardType="decimal-pad" placeholder="Max" style={{ flex: 1, borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, padding: 12, fontSize: 14 }} />
        </View>
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 14 }}>
          <View style={{ flexDirection: 'row', borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, overflow: 'hidden' }}>
            {CURRENCIES.map((c) => (
              <Pressable key={c} onPress={() => setSalaryCurrency(c)} style={{ paddingHorizontal: 10, paddingVertical: 8, backgroundColor: salaryCurrency === c ? colors.primary : '#fff' }}>
                <Text style={{ fontSize: 12, fontWeight: '600', color: salaryCurrency === c ? '#fff' : '#4b5563' }}>{c}</Text>
              </Pressable>
            ))}
          </View>
          <View style={{ flexDirection: 'row', borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, overflow: 'hidden' }}>
            {PERIODS.map((p) => (
              <Pressable key={p} onPress={() => setSalaryPeriod(p)} style={{ paddingHorizontal: 12, paddingVertical: 8, backgroundColor: salaryPeriod === p ? colors.primary : '#fff' }}>
                <Text style={{ fontSize: 12, fontWeight: '600', color: salaryPeriod === p ? '#fff' : '#4b5563' }}>{p === 'monthly' ? '/mo' : '/yr'}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Live aboard */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <Text style={{ fontSize: 13, fontWeight: '600', color: '#374151' }}>Live aboard</Text>
          <Switch value={liveAboard} onValueChange={setLiveAboard} />
        </View>

        {/* Certs */}
        <SectionHeader title="Required certifications" />
        <Pressable onPress={() => setShowCerts(true)} style={{ borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, padding: 12, marginBottom: 14 }}>
          <Text style={{ color: certIds.length > 0 ? '#111' : '#9ca3af' }}>{certIds.length > 0 ? `${certIds.length} selected` : 'None'}</Text>
        </Pressable>

        {/* Languages */}
        <SectionHeader title="Required languages" />
        <Pressable onPress={() => setShowLangs(true)} style={{ borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, padding: 12, marginBottom: 14 }}>
          <Text style={{ color: langCodes.length > 0 ? '#111' : '#9ca3af' }}>{langCodes.length > 0 ? `${langCodes.length} selected` : 'None'}</Text>
        </Pressable>

        {/* Experience bracket */}
        <SectionHeader title="Experience bracket" />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            <Pill label="Any" selected={!bracketId} onPress={() => setBracketId(null)} />
            {(brackets ?? []).map((b) => (
              <Pill key={b.id} label={b.label} selected={b.id === bracketId} onPress={() => setBracketId(b.id)} />
            ))}
          </View>
        </ScrollView>

        {/* Shortlist cap */}
        <FormInput label="Shortlist cap" value={shortlistCap} onChangeText={(t: string) => setShortlistCap(t.replace(/[^0-9]/g, ''))} keyboardType="number-pad" />

        {/* Contract type */}
        <SectionHeader title="Contract type" />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            {CONTRACT_TYPES.map((ct) => (
              <Pill key={ct} label={ct} selected={contractType === ct} onPress={() => setContractType(ct)} />
            ))}
          </View>
        </ScrollView>

        {/* Contract details (non-permanent) */}
        {contractType !== 'permanent' && (
          <FormInput label="Contract details" value={contractDetails} onChangeText={setContractDetails} multiline placeholder="Rotation, schedule details..." style={{ minHeight: 60, textAlignVertical: 'top' }} />
        )}

        {/* Description */}
        <FormInput label="Description" value={description} onChangeText={setDescription} multiline placeholder="Job description..." style={{ minHeight: 80, textAlignVertical: 'top' }} />

        {/* Meals */}
        <SectionHeader title="Meals provided" />
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 14 }}>
          {MEAL_OPTIONS.map((meal) => (
            <Pill key={meal} label={meal.charAt(0).toUpperCase() + meal.slice(1)} selected={meals.includes(meal)} onPress={() => toggleMeal(meal)} />
          ))}
        </View>

        {/* Positions */}
        <FormInput label="Positions available" value={positions} onChangeText={(t: string) => setPositions(t.replace(/[^0-9]/g, ''))} keyboardType="number-pad" />

        {/* Notes */}
        <FormInput label="Notes" value={notes} onChangeText={setNotes} multiline placeholder="Additional notes..." style={{ minHeight: 60, textAlignVertical: 'top' }} />

        {/* Submit */}
        <View style={{ marginTop: 6 }}>
          <Button variant="primary" label={submitting ? 'Posting...' : 'Post permanent'} loading={submitting} onPress={handleSubmit} />
        </View>
      </ScrollView>

      {showVessel && <VesselSelector value={vesselId} onChange={setVesselId} onDismiss={() => setShowVessel(false)} />}
      {showRole && <FormRolePicker value={roleId} onChange={setRoleId} onDismiss={() => setShowRole(false)} />}
      {showLocation && <FormLocationPicker value={portId} onChange={setPortId} onDismiss={() => setShowLocation(false)} />}
      {showCerts && <FormCertPicker value={certIds} onChange={setCertIds} onDismiss={() => setShowCerts(false)} />}
      {showLangs && <FormLanguagePicker value={langCodes} onChange={setLangCodes} onDismiss={() => setShowLangs(false)} />}
    </SafeAreaView>
  );
}
