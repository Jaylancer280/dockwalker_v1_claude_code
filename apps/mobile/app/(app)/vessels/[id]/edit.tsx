import { useState, useCallback, useMemo } from 'react';
import { View, Text, Alert, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useVessels } from '@/hooks/use-vessels';
import { apiPatch } from '@/lib/api';
import { Button, FormInput, SectionHeader, ScreenHeader, Pill } from '@/components/ui';

export default function EditVesselScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: vessels, invalidate } = useVessels();

  const vessel = useMemo(
    () => vessels?.find((v) => v.id === id),
    [vessels, id],
  );

  const [name, setName] = useState(vessel?.name ?? '');
  const [vesselType, setVesselType] = useState<string>(vessel?.vessel_type ?? 'motor');
  const [loaMeters, setLoaMeters] = useState(vessel?.loa_meters?.toString() ?? '');
  const [submitting, setSubmitting] = useState(false);

  const handleSave = useCallback(async () => {
    if (!name.trim()) {
      Alert.alert('Required', 'Vessel name is required');
      return;
    }
    const loa = parseFloat(loaMeters);
    if (!loa || loa <= 0) {
      Alert.alert('Required', 'Valid LOA is required');
      return;
    }

    setSubmitting(true);
    const result = await apiPatch(`/api/vessels/${id}`, {
      name: name.trim(),
      vesselType,
      loaMeters: loa,
    });
    setSubmitting(false);

    if (result.ok) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await invalidate();
      router.back();
    } else {
      Alert.alert('Error', result.error);
    }
  }, [id, name, vesselType, loaMeters, invalidate]);

  if (!vessel) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#f9fafb' }}>
        <ScreenHeader title="Edit Vessel" onBack={() => router.back()} />
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <Text style={{ color: '#9ca3af' }}>Vessel not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f9fafb' }}>
      <ScreenHeader title="Edit Vessel" onBack={() => router.back()} />

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>
        {/* IMO (read-only) */}
        <SectionHeader title="IMO number" subtitle="Immutable once set" />
        <View style={{ borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 8, padding: 12, marginBottom: 14, backgroundColor: '#f9fafb' }}>
          <Text style={{ fontSize: 14, color: '#6b7280' }}>{vessel.imo_number}</Text>
        </View>

        <FormInput label="Vessel name" required value={name} onChangeText={setName} placeholder="e.g. Ocean Spirit" />

        <SectionHeader title="Type *" />
        <View style={{ flexDirection: 'row', gap: 6, marginBottom: 14 }}>
          <Pill label="Motor" selected={vesselType === 'motor'} onPress={() => setVesselType('motor')} />
          <Pill label="Sail" selected={vesselType === 'sail'} onPress={() => setVesselType('sail')} />
        </View>

        <FormInput label="LOA (meters)" required value={loaMeters} onChangeText={setLoaMeters} keyboardType="decimal-pad" placeholder="e.g. 45" />

        {/* NDA flag (read-only warning if set) */}
        {vessel.nda_flag && (
          <View style={{ backgroundColor: '#fef2f2', borderRadius: 8, padding: 12, marginBottom: 14 }}>
            <Text style={{ fontSize: 13, color: '#dc2626', fontWeight: '600' }}>NDA vessel</Text>
            <Text style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>NDA status cannot be changed once set</Text>
          </View>
        )}

        <View style={{ marginTop: 8 }}>
          <Button variant="primary" label={submitting ? 'Saving...' : 'Save changes'} loading={submitting} onPress={handleSave} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
