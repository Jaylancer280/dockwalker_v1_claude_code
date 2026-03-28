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
const MEAL_OPTIONS = ['Breakfast', 'Lunch', 'Dinner'] as const;

export default function PostDayworkScreen() {
  const { person } = useAuth();
  const { data: brackets } = useExperienceBrackets();

  // Hat guard
  if (person?.current_hat === 'crew') return <Redirect href="/(app)/(tabs)/discover" />;

  const [vesselId, setVesselId] = useState<string | null>(null);
  const [roleId, setRoleId] = useState<string | null>(null);
  const [portId, setPortId] = useState<string | null>(null);
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [workingDays, setWorkingDays] = useState('');
  const [dayRate, setDayRate] = useState('');
  const [currency, setCurrency] = useState<string>('EUR');
  const [certIds, setCertIds] = useState<string[]>([]);
  const [langCodes, setLangCodes] = useState<string[]>([]);
  const [bracketId, setBracketId] = useState<string | null>(null);
  const [meals, setMeals] = useState<string[]>([]);
  const [notes, setNotes] = useState('');
  const [positions, setPositions] = useState('1');
  const [permanentOpp, setPermanentOpp] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Picker visibility
  const [showVessel, setShowVessel] = useState(false);
  const [showRole, setShowRole] = useState(false);
  const [showLocation, setShowLocation] = useState(false);
  const [showCerts, setShowCerts] = useState(false);
  const [showLangs, setShowLangs] = useState(false);
  const [showStartDate, setShowStartDate] = useState(false);
  const [showEndDate, setShowEndDate] = useState(false);

  const toggleMeal = useCallback((meal: string) => {
    setMeals((prev) => prev.includes(meal) ? prev.filter((m) => m !== meal) : [...prev, meal]);
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!vesselId || !roleId || !portId || !startDate || !endDate || !dayRate) {
      Alert.alert('Missing fields', 'Vessel, role, location, dates, and day rate are required');
      return;
    }
    const parsedRate = parseFloat(dayRate);
    if (isNaN(parsedRate) || parsedRate <= 0) {
      Alert.alert('Invalid rate', 'Enter a valid day rate');
      return;
    }
    const parsedDays = parseInt(workingDays, 10);
    const dateSpan = Math.ceil((endDate.getTime() - startDate.getTime()) / 86_400_000) + 1;
    if (parsedDays > dateSpan) {
      Alert.alert('Invalid working days', `Working days cannot exceed date span (${dateSpan} days)`);
      return;
    }

    setSubmitting(true);
    const body: Record<string, unknown> = {
      vesselId,
      roleId,
      locationPortId: portId,
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0],
      workingDays: parsedDays || dateSpan,
      dayRate: parsedRate,
      currency,
      meals,
      notes: notes.trim() || undefined,
      positionsAvailable: parseInt(positions, 10) || 1,
      permanentOpportunity: permanentOpp,
    };
    if (certIds.length > 0) body.requiredCertificationIds = certIds;
    if (langCodes.length > 0) body.requiredLanguages = langCodes;
    if (bracketId) body.experienceBracketId = bracketId;

    const result = await apiPost('/api/daywork', body);
    setSubmitting(false);

    if (result.ok) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace('/(app)/(tabs)/my-jobs');
    } else {
      Alert.alert('Failed to post', result.error);
    }
  }, [vesselId, roleId, portId, startDate, endDate, workingDays, dayRate, currency, certIds, langCodes, bracketId, meals, notes, positions, permanentOpp]);

  const fmt = (d: Date | null) => d ? d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Select';

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f9fafb' }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12 }}>
        <Pressable onPress={() => router.back()}>
          <Text style={{ fontSize: 14, color: '#2563eb' }}>← Back</Text>
        </Pressable>
        <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#111' }}>Post Daywork</Text>
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
          <DateTimePicker value={startDate ?? new Date()} mode="date" minimumDate={new Date()} onChange={(_, d) => { setShowStartDate(Platform.OS === 'ios'); if (d) setStartDate(d); }} />
        )}

        {/* End date */}
        <Text style={{ fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 4 }}>End date *</Text>
        <Pressable onPress={() => setShowEndDate(true)} style={{ borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, padding: 12, marginBottom: 14 }}>
          <Text style={{ color: endDate ? '#111' : '#9ca3af' }}>{fmt(endDate)}</Text>
        </Pressable>
        {showEndDate && (
          <DateTimePicker value={endDate ?? startDate ?? new Date()} mode="date" minimumDate={startDate ?? new Date()} onChange={(_, d) => { setShowEndDate(Platform.OS === 'ios'); if (d) setEndDate(d); }} />
        )}

        {/* Working days */}
        <Text style={{ fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 4 }}>Working days</Text>
        <TextInput value={workingDays} onChangeText={setWorkingDays} keyboardType="number-pad" placeholder="Auto from dates" style={{ borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, padding: 12, marginBottom: 14, fontSize: 14 }} />

        {/* Day rate + currency */}
        <Text style={{ fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 4 }}>Day rate *</Text>
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 14 }}>
          <TextInput value={dayRate} onChangeText={setDayRate} keyboardType="decimal-pad" placeholder="Amount" style={{ flex: 1, borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, padding: 12, fontSize: 14 }} />
          <View style={{ flexDirection: 'row', borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, overflow: 'hidden' }}>
            {CURRENCIES.map((c) => (
              <Pressable key={c} onPress={() => setCurrency(c)} style={{ paddingHorizontal: 10, paddingVertical: 12, backgroundColor: currency === c ? '#2563eb' : '#fff' }}>
                <Text style={{ fontSize: 12, fontWeight: '600', color: currency === c ? '#fff' : '#4b5563' }}>{c}</Text>
              </Pressable>
            ))}
          </View>
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

        {/* Meals */}
        <Text style={{ fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 4 }}>Meals provided</Text>
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 14 }}>
          {MEAL_OPTIONS.map((meal) => (
            <Pressable key={meal} onPress={() => toggleMeal(meal)} style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, backgroundColor: meals.includes(meal) ? '#2563eb' : '#f3f4f6' }}>
              <Text style={{ fontSize: 12, color: meals.includes(meal) ? '#fff' : '#4b5563' }}>{meal}</Text>
            </Pressable>
          ))}
        </View>

        {/* Notes */}
        <Text style={{ fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 4 }}>Notes</Text>
        <TextInput value={notes} onChangeText={setNotes} multiline placeholder="Special requirements..." style={{ borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, padding: 12, marginBottom: 14, minHeight: 80, fontSize: 14, textAlignVertical: 'top' }} />

        {/* Positions */}
        <Text style={{ fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 4 }}>Positions available</Text>
        <TextInput value={positions} onChangeText={(t) => setPositions(t.replace(/[^0-9]/g, ''))} keyboardType="number-pad" style={{ borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, padding: 12, marginBottom: 14, fontSize: 14 }} />

        {/* Permanent opportunity */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <Text style={{ fontSize: 13, fontWeight: '600', color: '#374151' }}>Permanent opportunity</Text>
          <Switch value={permanentOpp} onValueChange={setPermanentOpp} />
        </View>

        {/* Submit */}
        <Pressable onPress={handleSubmit} disabled={submitting} style={{ backgroundColor: submitting ? '#93c5fd' : '#2563eb', borderRadius: 12, paddingVertical: 14, alignItems: 'center' }}>
          <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600' }}>{submitting ? 'Posting...' : 'Post daywork'}</Text>
        </Pressable>
      </ScrollView>

      {/* Bottom sheet pickers */}
      {showVessel && <VesselSelector value={vesselId} onChange={setVesselId} onDismiss={() => setShowVessel(false)} />}
      {showRole && <FormRolePicker value={roleId} onChange={setRoleId} onDismiss={() => setShowRole(false)} />}
      {showLocation && <FormLocationPicker value={portId} onChange={setPortId} onDismiss={() => setShowLocation(false)} />}
      {showCerts && <FormCertPicker value={certIds} onChange={setCertIds} onDismiss={() => setShowCerts(false)} />}
      {showLangs && <FormLanguagePicker value={langCodes} onChange={setLangCodes} onDismiss={() => setShowLangs(false)} />}
    </SafeAreaView>
  );
}
