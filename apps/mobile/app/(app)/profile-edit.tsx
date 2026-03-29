import { useState, useCallback } from 'react';
import { View, Text, Pressable, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useAuth } from '@/lib/auth-context';
import { useProfile } from '@/hooks/use-profile';
import { apiPatch } from '@/lib/api';
import { FormRolePicker } from '@/components/form-role-picker';
import { FormCertPicker } from '@/components/form-cert-picker';
import { FormLanguagePicker } from '@/components/form-language-picker';
import { FormNationalityPicker } from '@/components/form-nationality-picker';
import { FormVisaPicker } from '@/components/form-visa-picker';
import { FormLocationPicker } from '@/components/form-location-picker';
import { Button, FormInput, SectionHeader, ScreenHeader, Pill, colors } from '@/components/ui';

export default function ProfileEditScreen() {
  const { person } = useAuth();
  const { data: profileData, invalidate } = useProfile();
  const profile = profileData?.profile;
  const isAgent = person?.identity_type === 'agent';

  const [displayName, setDisplayName] = useState(profile?.display_name ?? '');
  const [deckName, setDeckName] = useState(profile?.deck_name ?? '');
  const [bio, setBio] = useState(profile?.bio ?? '');
  const [desiredRoleId, setDesiredRoleId] = useState<string | null>(profile?.desired_role_id ?? null);
  const [locationCityId, setLocationCityId] = useState<string | null>(profile?.location_city_id ?? null);
  const [locationPortId, setLocationPortId] = useState<string | null>(profile?.location_port_id ?? null);
  const [nationalityId, setNationalityId] = useState<string | null>(profile?.nationality_id ?? null);
  const [visaIds, setVisaIds] = useState<string[]>(profile?.visa_ids ?? []);
  const [certificationIds, setCertificationIds] = useState<string[]>(profile?.certification_ids ?? []);
  const [languages, setLanguages] = useState<string[]>(profile?.languages ?? []);
  const [permanentAvailability, setPermanentAvailability] = useState<string | null>(profile?.permanent_availability ?? null);
  const [noticePeriodDays, setNoticePeriodDays] = useState(profile?.notice_period_days?.toString() ?? '');
  const [currentlyEmployed, setCurrentlyEmployed] = useState(profile?.currently_employed ?? false);
  const [agencyName, setAgencyName] = useState(profile?.agency_name ?? '');
  const [roleSpecializationIds, setRoleSpecializationIds] = useState<string[]>(profile?.role_specialization_ids ?? []);
  const [submitting, setSubmitting] = useState(false);

  // Picker visibility
  const [showDesiredRole, setShowDesiredRole] = useState(false);
  const [showLocation, setShowLocation] = useState(false);
  const [showNationality, setShowNationality] = useState(false);
  const [showVisas, setShowVisas] = useState(false);
  const [showCerts, setShowCerts] = useState(false);
  const [showLanguages, setShowLanguages] = useState(false);
  const [showSpecializations, setShowSpecializations] = useState(false);

  const handleSave = useCallback(async () => {
    if (!displayName.trim()) {
      Alert.alert('Required', 'Display name is required');
      return;
    }

    setSubmitting(true);
    const body: Record<string, unknown> = {
      displayName: displayName.trim(),
      deckName: deckName.trim() || null,
      bio: bio.trim() || null,
      desiredRoleId,
      locationCityId,
      locationPortId,
      nationalityId,
      visaIds,
      certificationIds,
      languages,
      permanentAvailability: permanentAvailability || null,
      noticePeriodDays: permanentAvailability === 'after_notice' && noticePeriodDays ? parseInt(noticePeriodDays, 10) : null,
      currentlyEmployed,
    };

    if (isAgent) {
      body.agencyName = agencyName.trim() || null;
      body.roleSpecializationIds = roleSpecializationIds;
    }

    const result = await apiPatch('/api/profile', body);
    setSubmitting(false);

    if (result.ok) {
      await invalidate();
      router.back();
    } else {
      Alert.alert('Error', result.error);
    }
  }, [displayName, deckName, bio, desiredRoleId, locationCityId, locationPortId, nationalityId, visaIds, certificationIds, languages, permanentAvailability, noticePeriodDays, currentlyEmployed, isAgent, agencyName, roleSpecializationIds, invalidate]);

  if (!profile) return null;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f9fafb' }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingTop: 8, paddingBottom: 8 }}>
        <Pressable onPress={() => router.back()}>
          <Text style={{ fontSize: 14, color: colors.primary }}>Cancel</Text>
        </Pressable>
        <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#111' }}>Edit Profile</Text>
        <Button variant="primary" size="sm" label="Save" loading={submitting} onPress={handleSave} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>
        <FormInput label="Display name" required value={displayName} onChangeText={setDisplayName} maxLength={100} placeholder="Your name" />
        <FormInput label="Deck name" value={deckName} onChangeText={setDeckName} maxLength={50} placeholder="Nickname on deck" />
        <FormInput label="Bio" value={bio} onChangeText={setBio} maxLength={250} multiline placeholder="Tell employers about yourself..." style={{ minHeight: 80, textAlignVertical: 'top' }} />

        {/* Desired role */}
        <SectionHeader title="Desired role" />
        <Pressable onPress={() => setShowDesiredRole(true)} style={{ borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, padding: 12, marginBottom: 14 }}>
          <Text style={{ color: desiredRoleId ? '#111' : '#9ca3af' }}>{desiredRoleId ? 'Role selected' : 'Select desired role'}</Text>
        </Pressable>

        {/* Location */}
        <SectionHeader title="Location" />
        <Pressable onPress={() => setShowLocation(true)} style={{ borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, padding: 12, marginBottom: 14 }}>
          <Text style={{ color: locationPortId ? '#111' : '#9ca3af' }}>{locationPortId ? 'Location selected' : 'Select port/marina'}</Text>
        </Pressable>

        {/* Nationality */}
        <SectionHeader title="Nationality" />
        <Pressable onPress={() => setShowNationality(true)} style={{ borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, padding: 12, marginBottom: 14 }}>
          <Text style={{ color: nationalityId ? '#111' : '#9ca3af' }}>{nationalityId ? 'Nationality selected' : 'Select nationality'}</Text>
        </Pressable>

        {/* Visas */}
        <SectionHeader title="Visas" />
        <Pressable onPress={() => setShowVisas(true)} style={{ borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, padding: 12, marginBottom: 14 }}>
          <Text style={{ color: visaIds.length > 0 ? '#111' : '#9ca3af' }}>{visaIds.length > 0 ? `${visaIds.length} selected` : 'None'}</Text>
        </Pressable>

        {/* Certifications */}
        <SectionHeader title="Certifications" />
        <Pressable onPress={() => setShowCerts(true)} style={{ borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, padding: 12, marginBottom: 14 }}>
          <Text style={{ color: certificationIds.length > 0 ? '#111' : '#9ca3af' }}>{certificationIds.length > 0 ? `${certificationIds.length} selected` : 'None'}</Text>
        </Pressable>

        {/* Languages */}
        <SectionHeader title="Languages" />
        <Pressable onPress={() => setShowLanguages(true)} style={{ borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, padding: 12, marginBottom: 14 }}>
          <Text style={{ color: languages.length > 0 ? '#111' : '#9ca3af' }}>{languages.length > 0 ? `${languages.length} selected` : 'None'}</Text>
        </Pressable>

        {/* Permanent availability */}
        <SectionHeader title="Permanent availability" />
        <View style={{ flexDirection: 'row', gap: 6, marginBottom: 14 }}>
          {(['immediate', 'after_notice', 'not_looking'] as const).map((opt) => (
            <Pill
              key={opt}
              label={opt === 'immediate' ? 'Immediate' : opt === 'after_notice' ? 'After notice' : 'Not looking'}
              selected={permanentAvailability === opt}
              onPress={() => setPermanentAvailability(permanentAvailability === opt ? null : opt)}
            />
          ))}
        </View>

        {permanentAvailability === 'after_notice' && (
          <FormInput label="Notice period (days)" value={noticePeriodDays} onChangeText={setNoticePeriodDays} keyboardType="number-pad" placeholder="e.g. 30" />
        )}

        {/* Currently employed */}
        <SectionHeader title="Currently employed" />
        <View style={{ flexDirection: 'row', gap: 6, marginBottom: 14 }}>
          <Pill label="Yes" selected={currentlyEmployed} onPress={() => setCurrentlyEmployed(true)} />
          <Pill label="No" selected={!currentlyEmployed} onPress={() => setCurrentlyEmployed(false)} />
        </View>

        {/* Agent-only fields */}
        {isAgent && (
          <>
            <SectionHeader title="Agency name" />
            <FormInput value={agencyName} onChangeText={setAgencyName} placeholder="Your agency" />

            <SectionHeader title="Role specializations" />
            <Pressable onPress={() => setShowSpecializations(true)} style={{ borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, padding: 12, marginBottom: 14 }}>
              <Text style={{ color: roleSpecializationIds.length > 0 ? '#111' : '#9ca3af' }}>
                {roleSpecializationIds.length > 0 ? `${roleSpecializationIds.length} selected` : 'None'}
              </Text>
            </Pressable>
          </>
        )}
      </ScrollView>

      {/* Pickers */}
      {showDesiredRole && <FormRolePicker value={desiredRoleId} onChange={(id) => { setDesiredRoleId(id); setShowDesiredRole(false); }} onDismiss={() => setShowDesiredRole(false)} />}
      {showLocation && <FormLocationPicker value={locationPortId} onChange={(id) => { setLocationPortId(id); setShowLocation(false); }} onDismiss={() => setShowLocation(false)} />}
      {showNationality && <FormNationalityPicker value={nationalityId} onChange={(id) => { setNationalityId(id); }} onDismiss={() => setShowNationality(false)} />}
      {showVisas && <FormVisaPicker value={visaIds} onChange={setVisaIds} onDismiss={() => setShowVisas(false)} />}
      {showCerts && <FormCertPicker value={certificationIds} onChange={setCertificationIds} onDismiss={() => setShowCerts(false)} />}
      {showLanguages && <FormLanguagePicker value={languages} onChange={setLanguages} onDismiss={() => setShowLanguages(false)} />}
      {showSpecializations && <FormRolePicker value={roleSpecializationIds[0] ?? null} onChange={(id) => { if (id) setRoleSpecializationIds((prev) => prev.includes(id) ? prev.filter((r) => r !== id) : [...prev, id]); }} onDismiss={() => setShowSpecializations(false)} />}
    </SafeAreaView>
  );
}
