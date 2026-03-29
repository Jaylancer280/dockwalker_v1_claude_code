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
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12 }}>
        <Pressable onPress={() => router.back()}>
          <Text style={{ fontSize: 14, color: '#2563eb' }}>← Back</Text>
        </Pressable>
        <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#111' }}>Post Permanent</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>
        {/* Vessel */}
        <Text style={{ fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 4 }}>Vessel *</Text>
        <Pressable onPress={() => setShowVessel(true)} style={{ borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, padding: 12, marginBottom: 14 }}>
          <Text style={{ color: vesselId ? '#111' : '#9ca3af' }}>{vesselId ? 'Vessel selected' : 'Select vessel'}</Text>
        </Pressable>

        {/* Role */}
        <Text style={{ fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 4 }}>Role *</Text>
        <Pressable onPress={() => setShowRole(true)} style={{ borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, padding: 12, marginBottom: 14 }}>
          <Text style={{ color: roleId ? '#111' : '#9ca3af' }}>{roleId ? 'Role selected' : 'Select role'}</Text>
        </Pressable>

        {/* Location */}
        <Text style={{ fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 4 }}>Location *</Text>
        <Pressable onPress={() => setShowLocation(true)} style={{ borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, padding: 12, marginBottom: 14 }}>
          <Text style={{ color: portId ? '#111' : '#9ca3af' }}>{portId ? 'Location selected' : 'Select port/marina'}</Text>
        </Pressable>

        {/* Start date */}
        <Text style={{ fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 4 }}>Start date *</Text>
        <Pressable onPress={() => setShowStartDate(true)} style={{ borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, padding: 12, marginBottom: 14 }}>
          <Text style={{ color: startDate ? '#111' : '#9ca3af' }}>{fmt(startDate)}</Text>
        </Pressable>
        {showStartDate && (
          <DateTimePicker value={startDate ?? new Date()} mode="date" onChange={(_, d) => { setShowStartDate(Platform.OS === 'ios'); if (d) setStartDate(d); }} />
        )}

        {/* Salary */}
        <Text style={{ fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 4 }}>Salary range *</Text>
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
          <TextInput value={salaryMin} onChangeText={setSalaryMin} keyboardType="decimal-pad" placeholder="Min" style={{ flex: 1, borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, padding: 12, fontSize: 14 }} />
          <TextInput value={salaryMax} onChangeText={setSalaryMax} keyboardType="decimal-pad" placeholder="Max" style={{ flex: 1, borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, padding: 12, fontSize: 14 }} />
        </View>
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 14 }}>
          <View style={{ flexDirection: 'row', borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, overflow: 'hidden' }}>
            {CURRENCIES.map((c) => (
              <Pressable key={c} onPress={() => setSalaryCurrency(c)} style={{ paddingHorizontal: 10, paddingVertical: 8, backgroundColor: salaryCurrency === c ? '#2563eb' : '#fff' }}>
                <Text style={{ fontSize: 12, fontWeight: '600', color: salaryCurrency === c ? '#fff' : '#4b5563' }}>{c}</Text>
              </Pressable>
            ))}
          </View>
          <View style={{ flexDirection: 'row', borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, overflow: 'hidden' }}>
            {PERIODS.map((p) => (
              <Pressable key={p} onPress={() => setSalaryPeriod(p)} style={{ paddingHorizontal: 12, paddingVertical: 8, backgroundColor: salaryPeriod === p ? '#2563eb' : '#fff' }}>
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
        <Text style={{ fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 4 }}>Required certifications</Text>
        <Pressable onPress={() => setShowCerts(true)} style={{ borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, padding: 12, marginBottom: 14 }}>
          <Text style={{ color: certIds.length > 0 ? '#111' : '#9ca3af' }}>{certIds.length > 0 ? `${certIds.length} selected` : 'None'}</Text>
        </Pressable>

        {/* Languages */}
        <Text style={{ fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 4 }}>Required languages</Text>
        <Pressable onPress={() => setShowLangs(true)} style={{ borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, padding: 12, marginBottom: 14 }}>
          <Text style={{ color: langCodes.length > 0 ? '#111' : '#9ca3af' }}>{langCodes.length > 0 ? `${langCodes.length} selected` : 'None'}</Text>
        </Pressable>

        {/* Experience bracket */}
        <Text style={{ fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 4 }}>Experience bracket</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            <Pressable onPress={() => setBracketId(null)} style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, backgroundColor: !bracketId ? '#2563eb' : '#f3f4f6' }}>
              <Text style={{ fontSize: 12, color: !bracketId ? '#fff' : '#4b5563' }}>Any</Text>
            </Pressable>
            {(brackets ?? []).map((b) => (
              <Pressable key={b.id} onPress={() => setBracketId(b.id)} style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, backgroundColor: b.id === bracketId ? '#2563eb' : '#f3f4f6' }}>
                <Text style={{ fontSize: 12, color: b.id === bracketId ? '#fff' : '#4b5563' }}>{b.label}</Text>
              </Pressable>
            ))}
          </View>
        </ScrollView>

        {/* Shortlist cap */}
        <Text style={{ fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 4 }}>Shortlist cap</Text>
        <TextInput value={shortlistCap} onChangeText={(t) => setShortlistCap(t.replace(/[^0-9]/g, ''))} keyboardType="number-pad" style={{ borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, padding: 12, marginBottom: 14, fontSize: 14 }} />

        {/* Contract type */}
        <Text style={{ fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 4 }}>Contract type</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            {CONTRACT_TYPES.map((ct) => (
              <Pressable key={ct} onPress={() => setContractType(ct)} style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, backgroundColor: contractType === ct ? '#2563eb' : '#f3f4f6' }}>
                <Text style={{ fontSize: 12, color: contractType === ct ? '#fff' : '#4b5563' }}>{ct}</Text>
              </Pressable>
            ))}
          </View>
        </ScrollView>

        {/* Contract details (non-permanent) */}
        {contractType !== 'permanent' && (
          <>
            <Text style={{ fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 4 }}>Contract details</Text>
            <TextInput value={contractDetails} onChangeText={setContractDetails} multiline placeholder="Rotation, schedule details..." style={{ borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, padding: 12, marginBottom: 14, minHeight: 60, fontSize: 14, textAlignVertical: 'top' }} />
          </>
        )}

        {/* Description */}
        <Text style={{ fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 4 }}>Description</Text>
        <TextInput value={description} onChangeText={setDescription} multiline placeholder="Job description..." style={{ borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, padding: 12, marginBottom: 14, minHeight: 80, fontSize: 14, textAlignVertical: 'top' }} />

        {/* Meals */}
        <Text style={{ fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 4 }}>Meals provided</Text>
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 14 }}>
          {MEAL_OPTIONS.map((meal) => (
            <Pressable key={meal} onPress={() => toggleMeal(meal)} style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, backgroundColor: meals.includes(meal) ? '#2563eb' : '#f3f4f6' }}>
              <Text style={{ fontSize: 12, color: meals.includes(meal) ? '#fff' : '#4b5563' }}>{meal.charAt(0).toUpperCase() + meal.slice(1)}</Text>
            </Pressable>
          ))}
        </View>

        {/* Positions */}
        <Text style={{ fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 4 }}>Positions available</Text>
        <TextInput value={positions} onChangeText={(t) => setPositions(t.replace(/[^0-9]/g, ''))} keyboardType="number-pad" style={{ borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, padding: 12, marginBottom: 14, fontSize: 14 }} />

        {/* Notes */}
        <Text style={{ fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 4 }}>Notes</Text>
        <TextInput value={notes} onChangeText={setNotes} multiline placeholder="Additional notes..." style={{ borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, padding: 12, marginBottom: 20, minHeight: 60, fontSize: 14, textAlignVertical: 'top' }} />

        {/* Submit */}
        <Pressable onPress={handleSubmit} disabled={submitting} style={{ backgroundColor: submitting ? '#93c5fd' : '#2563eb', borderRadius: 12, paddingVertical: 14, alignItems: 'center' }}>
          <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600' }}>{submitting ? 'Posting...' : 'Post permanent'}</Text>
        </Pressable>
      </ScrollView>

      {showVessel && <VesselSelector value={vesselId} onChange={setVesselId} onDismiss={() => setShowVessel(false)} />}
      {showRole && <FormRolePicker value={roleId} onChange={setRoleId} onDismiss={() => setShowRole(false)} />}
      {showLocation && <FormLocationPicker value={portId} onChange={setPortId} onDismiss={() => setShowLocation(false)} />}
      {showCerts && <FormCertPicker value={certIds} onChange={setCertIds} onDismiss={() => setShowCerts(false)} />}
      {showLangs && <FormLanguagePicker value={langCodes} onChange={setLangCodes} onDismiss={() => setShowLangs(false)} />}
    </SafeAreaView>
  );
}
