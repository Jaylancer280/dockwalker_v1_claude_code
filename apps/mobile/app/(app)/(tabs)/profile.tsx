import { useState, useCallback } from 'react';
import { View, Text, Pressable, ScrollView, RefreshControl, Alert, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useAuth } from '@/lib/auth-context';
import { useProfile } from '@/hooks/use-profile';
import { useExperiences, type Experience } from '@/hooks/use-experiences';
import { apiPost, apiDelete, apiUpload } from '@/lib/api';
import * as ImagePicker from 'expo-image-picker';
import { Button, Card, Pill, SectionHeader, EmptyState, colors } from '@/components/ui';

function ExperienceCard({ experience, onDelete }: { experience: Experience; onDelete: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const vessel = experience.vessels;
  const prefix = vessel.vessel_type === 'motor' ? 'M/Y' : 'S/Y';
  const dateRange = experience.is_current
    ? `${experience.start_date} — Present`
    : `${experience.start_date} — ${experience.end_date ?? ''}`;

  return (
    <Card style={{ marginBottom: 10 }}>
      <Pressable onPress={() => setExpanded(!expanded)}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 15, fontWeight: '600', color: '#111' }}>
              {prefix} {vessel.name}
            </Text>
            <Text style={{ fontSize: 13, color: '#6b7280' }}>
              {experience.yacht_roles.name} · {dateRange}
            </Text>
          </View>
          <Text style={{ fontSize: 16, color: '#9ca3af' }}>{expanded ? '▲' : '▼'}</Text>
        </View>
      </Pressable>

      {expanded && (
        <View style={{ marginTop: 10, borderTopWidth: 1, borderTopColor: '#f3f4f6', paddingTop: 10 }}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
            {experience.vessel_operation && (
              <View style={{ backgroundColor: '#f3f4f6', borderRadius: 10, paddingHorizontal: 6, paddingVertical: 2 }}>
                <Text style={{ fontSize: 11, color: '#4b5563' }}>{experience.vessel_operation}</Text>
              </View>
            )}
            {experience.flag_state && (
              <View style={{ backgroundColor: '#f3f4f6', borderRadius: 10, paddingHorizontal: 6, paddingVertical: 2 }}>
                <Text style={{ fontSize: 11, color: '#4b5563' }}>{experience.flag_state}</Text>
              </View>
            )}
            {experience.contract_type && (
              <View style={{ backgroundColor: '#f3f4f6', borderRadius: 10, paddingHorizontal: 6, paddingVertical: 2 }}>
                <Text style={{ fontSize: 11, color: '#4b5563' }}>{experience.contract_type}</Text>
              </View>
            )}
            {vessel.loa_meters && (
              <View style={{ backgroundColor: '#f3f4f6', borderRadius: 10, paddingHorizontal: 6, paddingVertical: 2 }}>
                <Text style={{ fontSize: 11, color: '#4b5563' }}>{vessel.loa_meters}m LOA</Text>
              </View>
            )}
            {vessel.vessel_size_bands?.label && (
              <View style={{ backgroundColor: '#f3f4f6', borderRadius: 10, paddingHorizontal: 6, paddingVertical: 2 }}>
                <Text style={{ fontSize: 11, color: '#4b5563' }}>{vessel.vessel_size_bands.label}</Text>
              </View>
            )}
          </View>
          {experience.description && (
            <Text style={{ fontSize: 13, color: '#4b5563', marginBottom: 8 }}>{experience.description}</Text>
          )}
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Button variant="ghost" size="sm" label="Edit" onPress={() => router.push(`/(app)/edit-experience/${experience.id}`)} style={{ flex: 1 }} />
            <Pressable onPress={onDelete} style={{ flex: 1, backgroundColor: '#fef2f2', borderRadius: 8, paddingVertical: 6, alignItems: 'center' }}>
              <Text style={{ color: '#dc2626', fontWeight: '600', fontSize: 13 }}>Delete</Text>
            </Pressable>
          </View>
        </View>
      )}
    </Card>
  );
}

export default function ProfileScreen() {
  const { person, refreshPerson } = useAuth();
  const { data: profileData, isLoading, invalidate } = useProfile();
  const { data: experiencesData, invalidate: invalidateExp } = useExperiences();
  const [refreshing, setRefreshing] = useState(false);

  const profile = profileData?.profile;
  const experiences = experiencesData?.experiences ?? [];
  const isCrew = person?.identity_type === 'crew';
  const isAgent = person?.identity_type === 'agent';

  const handleAvatarPress = useCallback(async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow access to your photo library to upload an avatar.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (result.canceled || !result.assets[0]) return;

    const asset = result.assets[0];
    const uri = asset.uri;
    const ext = uri.split('.').pop() ?? 'jpg';
    const mimeType = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';

    const formData = new FormData();
    formData.append('file', {
      uri,
      name: `avatar.${ext}`,
      type: mimeType,
    } as unknown as Blob);

    const uploadResult = await apiUpload<{ avatar_url: string }>('/api/profile/avatar', formData);
    if (uploadResult.ok) {
      invalidate();
    } else {
      Alert.alert('Upload failed', uploadResult.error);
    }
  }, [invalidate]);

  const handleDeleteAvatar = useCallback(() => {
    Alert.alert('Remove avatar?', 'Your profile photo will be removed.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          const result = await apiDelete('/api/profile/avatar');
          if (result.ok) {
            invalidate();
          } else {
            Alert.alert('Error', result.error);
          }
        },
      },
    ]);
  }, [invalidate]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([invalidate(), invalidateExp()]);
    setRefreshing(false);
  }, [invalidate, invalidateExp]);

  const handleHatSwitch = useCallback(async () => {
    if (!person || isAgent) return;
    const newHat = person.current_hat === 'crew' ? 'employer' : 'crew';
    const result = await apiPost<{ success: boolean; hat: string }>('/api/hat', { hat: newHat });
    if (result.ok) {
      await refreshPerson();
    } else {
      Alert.alert('Error', result.error);
    }
  }, [person, isAgent, refreshPerson]);

  const handleDeleteExperience = useCallback(async (exp: Experience) => {
    Alert.alert(
      'Delete experience?',
      `Remove ${exp.yacht_roles.name} on ${exp.vessels.name}? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const result = await apiDelete(`/api/experiences/${exp.id}`);
            if (result.ok) {
              invalidateExp();
              invalidate();
            } else {
              Alert.alert('Error', result.error);
            }
          },
        },
      ],
    );
  }, [invalidateExp, invalidate]);

  if (isLoading || !profile) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#f9fafb' }}>
        <EmptyState message="Loading profile..." />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f9fafb' }}>
      <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}>
        {/* Header */}
        <View style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            {/* Avatar */}
            <Pressable
              onPress={handleAvatarPress}
              onLongPress={profile.avatar_url ? handleDeleteAvatar : undefined}
            >
              {profile.avatar_url ? (
                <Image source={{ uri: profile.avatar_url }} style={{ width: 64, height: 64, borderRadius: 32 }} />
              ) : (
                <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: '#e5e7eb', alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontSize: 24, color: '#9ca3af' }}>{(profile.display_name ?? '?')[0].toUpperCase()}</Text>
                </View>
              )}
            </Pressable>

            <View style={{ flex: 1, marginLeft: 14 }}>
              <Text style={{ fontSize: 20, fontWeight: 'bold', color: '#111' }}>{profile.display_name}</Text>
              {profile.deck_name && (
                <Text style={{ fontSize: 13, color: '#6b7280' }}>{profile.deck_name}</Text>
              )}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 }}>
                {profile.nationalities?.flag_emoji && (
                  <Text style={{ fontSize: 18 }}>{profile.nationalities.flag_emoji}</Text>
                )}
                <View style={{ backgroundColor: '#eff6ff', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 }}>
                  <Text style={{ fontSize: 11, color: colors.primary, fontWeight: '600' }}>{person?.current_hat}</Text>
                </View>
              </View>
            </View>

            <Button variant="ghost" size="sm" label="Edit" onPress={() => router.push('/(app)/profile-edit')} />
          </View>

          {/* Hat switch (crew only, not agents) */}
          {isCrew && (
            <Pressable onPress={handleHatSwitch} style={{ marginTop: 12 }}>
              <Card style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={{ fontSize: 14, color: '#374151' }}>Current hat</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={{ fontSize: 14, fontWeight: '600', color: '#111' }}>{person?.current_hat}</Text>
                  <Text style={{ fontSize: 12, color: colors.primary }}>Switch →</Text>
                </View>
              </Card>
            </Pressable>
          )}
        </View>

        {/* Summary section */}
        <View style={{ paddingHorizontal: 16, marginBottom: 16 }}>
          <SectionHeader title="Summary" />
          <Card>
            {profile.yacht_roles && (
              <View style={{ marginBottom: 8 }}>
                <Text style={{ fontSize: 12, color: '#6b7280' }}>Primary role</Text>
                <Text style={{ fontSize: 14, fontWeight: '500', color: '#111' }}>{profile.yacht_roles.name}</Text>
              </View>
            )}
            {profile.experience_brackets && (
              <View style={{ marginBottom: 8 }}>
                <Text style={{ fontSize: 12, color: '#6b7280' }}>Experience</Text>
                <Text style={{ fontSize: 14, fontWeight: '500', color: '#111' }}>{profile.experience_brackets.label}</Text>
              </View>
            )}
            {(profile.vessel_size_bands?.length ?? 0) > 0 && (
              <View style={{ marginBottom: 8 }}>
                <Text style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>Vessel size exposure</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
                  {profile.vessel_size_bands.map((sb) => (
                    <Pill key={sb.id} label={sb.label} />
                  ))}
                </View>
              </View>
            )}
            {(profile.ports || profile.location_cities) && (
              <View>
                <Text style={{ fontSize: 12, color: '#6b7280' }}>Location</Text>
                <Text style={{ fontSize: 14, fontWeight: '500', color: '#111' }}>
                  {profile.ports?.name ?? ''}{profile.ports && profile.location_cities ? ', ' : ''}{profile.location_cities?.name ?? ''}
                </Text>
              </View>
            )}
          </Card>
        </View>

        {/* Looking For section */}
        <View style={{ paddingHorizontal: 16, marginBottom: 16 }}>
          <SectionHeader title="Looking For" />
          <Card>
            {profile.desired_roles && (
              <View style={{ marginBottom: 8 }}>
                <Text style={{ fontSize: 12, color: '#6b7280' }}>Desired role</Text>
                <Text style={{ fontSize: 14, fontWeight: '500', color: '#111' }}>{profile.desired_roles.name}</Text>
              </View>
            )}
            {profile.permanent_availability && (
              <View style={{ marginBottom: 8 }}>
                <Text style={{ fontSize: 12, color: '#6b7280' }}>Permanent availability</Text>
                <Text style={{ fontSize: 14, fontWeight: '500', color: '#111' }}>
                  {profile.permanent_availability === 'immediate' ? 'Available immediately' :
                   profile.permanent_availability === 'after_notice' ? `After ${profile.notice_period_days ?? '?'} days notice` :
                   'Not looking'}
                </Text>
              </View>
            )}
            <View>
              <Text style={{ fontSize: 12, color: '#6b7280' }}>Currently employed</Text>
              <Text style={{ fontSize: 14, fontWeight: '500', color: '#111' }}>{profile.currently_employed ? 'Yes' : 'No'}</Text>
            </View>
          </Card>
        </View>

        {/* About section */}
        <View style={{ paddingHorizontal: 16, marginBottom: 16 }}>
          <SectionHeader title="About" />
          <Card>
            {profile.bio && (
              <View style={{ marginBottom: 8 }}>
                <Text style={{ fontSize: 14, color: '#374151' }}>{profile.bio}</Text>
              </View>
            )}
            {(profile.certifications?.length ?? 0) > 0 && (
              <View style={{ marginBottom: 8 }}>
                <Text style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>Certifications</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
                  {profile.certifications.map((c) => (
                    <Pill key={c.id} label={c.name} />
                  ))}
                </View>
              </View>
            )}
            {(profile.profile_languages?.length ?? 0) > 0 && (
              <View style={{ marginBottom: 8 }}>
                <Text style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>Languages</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
                  {profile.profile_languages.map((l) => (
                    <Pill key={l.code} label={l.name} />
                  ))}
                </View>
              </View>
            )}
            {(profile.visa_types?.length ?? 0) > 0 && (
              <View>
                <Text style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>Visas</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
                  {profile.visa_types.map((v) => (
                    <Pill key={v.id} label={v.name} />
                  ))}
                </View>
              </View>
            )}
            {!profile.bio && (profile.certifications?.length ?? 0) === 0 && (profile.profile_languages?.length ?? 0) === 0 && (
              <Text style={{ fontSize: 13, color: '#9ca3af' }}>No details added yet</Text>
            )}
          </Card>
        </View>

        {/* Agent section */}
        {isAgent && profile.agency_name && (
          <View style={{ paddingHorizontal: 16, marginBottom: 16 }}>
            <SectionHeader title="Agency" />
            <Card>
              <Text style={{ fontSize: 14, fontWeight: '500', color: '#111' }}>{profile.agency_name}</Text>
              {(profile.role_specializations?.length ?? 0) > 0 && (
                <View style={{ marginTop: 8 }}>
                  <Text style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>Specializations</Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
                    {profile.role_specializations.map((r) => (
                      <Pill key={r.id} label={r.name} />
                    ))}
                  </View>
                </View>
              )}
            </Card>
          </View>
        )}

        {/* Experience section */}
        <View style={{ paddingHorizontal: 16, marginBottom: 24 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <SectionHeader title="Experience" />
            <Button variant="ghost" size="sm" label="+ Add" onPress={() => router.push('/(app)/add-experience')} />
          </View>

          {experiences.length === 0 ? (
            <Card>
              <Text style={{ fontSize: 13, color: '#9ca3af', textAlign: 'center' }}>No experiences added yet</Text>
            </Card>
          ) : (
            experiences.map((exp, i) => (
              <ExperienceCard
                key={exp.id}
                experience={exp}
                onDelete={() => handleDeleteExperience(exp)}
              />
            ))
          )}
        </View>

        {/* Vessel management link (employer/agent) */}
        {person?.current_hat !== 'crew' && (
          <View style={{ paddingHorizontal: 16, marginBottom: 40 }}>
            <Button variant="secondary" label="Manage Vessels" onPress={() => router.push('/(app)/vessels')} />
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
