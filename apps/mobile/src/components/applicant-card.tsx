import { View, Text } from 'react-native';
import { Image } from 'expo-image';
import { getDepartmentColor } from '@dockwalker/shared';
import type { Applicant } from '@/hooks/use-daywork-applicants';

function timeAgo(dateStr: string): string {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
  if (diff < 60) return `${diff}m ago`;
  const hours = Math.floor(diff / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

interface ApplicantCardProps {
  applicant: Applicant;
}

export function ApplicantCard({ applicant }: ApplicantCardProps) {
  const profile = applicant.profiles;
  const dept = profile?.yacht_roles?.department ?? 'deck';
  const deptColor = getDepartmentColor(dept);
  const barColor = deptColor === 'gold' ? '#B8860B' : '#708090';

  const location = profile?.ports
    ? `${profile.ports.name}, ${profile.ports.cities.name}`
    : null;

  return (
    <View style={{ flex: 1, borderRadius: 16, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e5e7eb', overflow: 'hidden' }}>
      <View style={{ height: 4, backgroundColor: barColor }} />

      <View style={{ padding: 16, flex: 1 }}>
        {/* Avatar + name row */}
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
          {profile?.avatar_url ? (
            <Image
              source={{ uri: profile.avatar_url }}
              style={{ width: 48, height: 48, borderRadius: 24, marginRight: 12 }}
            />
          ) : (
            <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: '#e5e7eb', marginRight: 12, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontSize: 18, color: '#9ca3af' }}>
                {(profile?.display_name ?? '?')[0].toUpperCase()}
              </Text>
            </View>
          )}
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#111' }} numberOfLines={1}>
              {profile?.display_name ?? 'Unknown'}
            </Text>
            {profile?.deck_name && (
              <Text style={{ fontSize: 13, color: '#6b7280' }}>{profile.deck_name}</Text>
            )}
          </View>
          {profile?.nationalities?.flag_emoji && (
            <Text style={{ fontSize: 24 }}>{profile.nationalities.flag_emoji}</Text>
          )}
        </View>

        {/* Role */}
        {profile?.yacht_roles?.name && (
          <Text style={{ fontSize: 14, color: '#374151', marginBottom: 4 }}>
            {profile.yacht_roles.name}
          </Text>
        )}

        {/* Experience bracket */}
        {profile?.experience_brackets?.label && (
          <View style={{ flexDirection: 'row', marginBottom: 6 }}>
            <View style={{ backgroundColor: '#f3f4f6', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 }}>
              <Text style={{ fontSize: 11, color: '#4b5563' }}>{profile.experience_brackets.label}</Text>
            </View>
          </View>
        )}

        {/* Location */}
        {location && (
          <Text style={{ fontSize: 13, color: '#6b7280', marginBottom: 4 }}>{location}</Text>
        )}

        {/* Availability */}
        <View style={{ flexDirection: 'row', gap: 6, marginBottom: 8 }}>
          {applicant.not_available ? (
            <View style={{ backgroundColor: '#fef2f2', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 }}>
              <Text style={{ fontSize: 11, color: '#dc2626' }}>Not available</Text>
            </View>
          ) : applicant.available_days > 0 ? (
            <View style={{ backgroundColor: '#f0fdf4', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 }}>
              <Text style={{ fontSize: 11, color: '#15803d' }}>{applicant.available_days} days available</Text>
            </View>
          ) : null}
          {applicant.source === 'invitation' && (
            <View style={{ backgroundColor: '#eff6ff', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 }}>
              <Text style={{ fontSize: 11, color: '#2563eb' }}>Invited</Text>
            </View>
          )}
        </View>

        {/* Certs */}
        {(profile?.certification_ids?.length ?? 0) > 0 && (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginBottom: 8 }}>
            {/* Cert IDs shown as pills — names resolved on display if canonical data available */}
            <View style={{ backgroundColor: '#f3f4f6', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 }}>
              <Text style={{ fontSize: 11, color: '#4b5563' }}>
                {profile!.certification_ids!.length} cert{profile!.certification_ids!.length !== 1 ? 's' : ''}
              </Text>
            </View>
          </View>
        )}

        {/* Application message */}
        {applicant.message && (
          <View style={{ backgroundColor: '#f9fafb', borderRadius: 8, padding: 8, marginBottom: 8 }}>
            <Text style={{ fontSize: 12, color: '#4b5563', fontStyle: 'italic' }} numberOfLines={3}>
              "{applicant.message}"
            </Text>
          </View>
        )}

        {/* Footer */}
        <View style={{ marginTop: 'auto' }}>
          <Text style={{ fontSize: 11, color: '#9ca3af' }}>Applied {timeAgo(applicant.created_at)}</Text>
        </View>
      </View>
    </View>
  );
}
