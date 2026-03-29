import { useState, useCallback, useMemo } from 'react';
import { View, Text, Pressable, Alert, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { FlashList } from '@shopify/flash-list';
import * as Haptics from 'expo-haptics';
import { usePermanentApplicants, type PermanentApplicant } from '@/hooks/use-permanent-applicants';
import { apiPost } from '@/lib/api';
import { getDepartmentColor } from '@dockwalker/shared';

type Tab = 'applicants' | 'shortlisted';

function ApplicantRow({
  applicant,
  onShortlist,
  onReject,
  onSelect,
  canSelect,
}: {
  applicant: PermanentApplicant;
  onShortlist?: (a: PermanentApplicant) => void;
  onReject: (a: PermanentApplicant) => void;
  onSelect?: (a: PermanentApplicant) => void;
  canSelect?: boolean;
}) {
  const dept = applicant.role_department ?? 'deck';
  const barColor = getDepartmentColor(dept) === 'gold' ? '#B8860B' : '#708090';

  return (
    <View style={{ backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#e5e7eb', overflow: 'hidden', marginBottom: 10 }}>
      <View style={{ height: 3, backgroundColor: barColor }} />
      <View style={{ padding: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
          <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#e5e7eb', alignItems: 'center', justifyContent: 'center', marginRight: 10 }}>
            <Text style={{ fontSize: 14, color: '#9ca3af' }}>{(applicant.display_name ?? '?')[0].toUpperCase()}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 15, fontWeight: '600', color: '#111' }}>
              {applicant.display_name}{applicant.nationality_flag ? ` ${applicant.nationality_flag}` : ''}
            </Text>
            <Text style={{ fontSize: 12, color: '#6b7280' }}>{applicant.role_name ?? ''}</Text>
          </View>
        </View>

        {/* Availability + experience */}
        <View style={{ flexDirection: 'row', gap: 6, marginBottom: 6, flexWrap: 'wrap' }}>
          {applicant.permanent_availability && (
            <View style={{ backgroundColor: '#f3f4f6', borderRadius: 10, paddingHorizontal: 6, paddingVertical: 2 }}>
              <Text style={{ fontSize: 11, color: '#4b5563' }}>
                {applicant.permanent_availability === 'immediate' ? 'Available now' :
                 applicant.permanent_availability === 'after_notice' ? `${applicant.notice_period_days}d notice` :
                 'Not looking'}
              </Text>
            </View>
          )}
          {applicant.experience_label && (
            <View style={{ backgroundColor: '#f3f4f6', borderRadius: 10, paddingHorizontal: 6, paddingVertical: 2 }}>
              <Text style={{ fontSize: 11, color: '#4b5563' }}>{applicant.experience_label}</Text>
            </View>
          )}
        </View>

        {/* Message */}
        {applicant.message && (
          <View style={{ backgroundColor: '#f9fafb', borderRadius: 8, padding: 8, marginBottom: 8 }}>
            <Text style={{ fontSize: 12, color: '#4b5563', fontStyle: 'italic' }} numberOfLines={2}>
              "{applicant.message}"
            </Text>
          </View>
        )}

        {/* Action buttons */}
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {onShortlist && (
            <Pressable
              onPress={() => onShortlist(applicant)}
              style={{ flex: 1, backgroundColor: '#2563eb', borderRadius: 8, paddingVertical: 8, alignItems: 'center' }}
            >
              <Text style={{ color: '#fff', fontWeight: '600', fontSize: 13 }}>Shortlist</Text>
            </Pressable>
          )}
          {onSelect && (
            <Pressable
              onPress={() => canSelect && onSelect(applicant)}
              disabled={!canSelect}
              style={{ flex: 1, backgroundColor: canSelect ? '#2563eb' : '#d1d5db', borderRadius: 8, paddingVertical: 8, alignItems: 'center' }}
            >
              <Text style={{ color: canSelect ? '#fff' : '#9ca3af', fontWeight: '600', fontSize: 13 }}>Select</Text>
            </Pressable>
          )}
          <Pressable
            onPress={() => onReject(applicant)}
            style={{ flex: 1, backgroundColor: '#fef2f2', borderRadius: 8, paddingVertical: 8, alignItems: 'center' }}
          >
            <Text style={{ color: '#dc2626', fontWeight: '600', fontSize: 13 }}>Reject</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

export default function PermanentReviewScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, isLoading, invalidate } = usePermanentApplicants(id);
  const [tab, setTab] = useState<Tab>('applicants');
  const [refreshing, setRefreshing] = useState(false);

  const applied = useMemo(
    () => (data?.applicants ?? []).filter((a) => a.status === 'applied'),
    [data],
  );
  const shortlisted = useMemo(
    () => (data?.applicants ?? []).filter((a) => a.status === 'shortlisted' || a.status === 'selected'),
    [data],
  );

  const canSelect = data?.posting_status === 'active';

  const handleShortlist = useCallback(
    (applicant: PermanentApplicant) => {
      Alert.alert('Shortlist?', `Add ${applicant.display_name} to shortlist?`, [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Shortlist',
          onPress: async () => {
            const result = await apiPost(`/api/permanent/${id}/applicants/${applicant.crew_person_id}/shortlist`);
            if (result.ok) {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              invalidate();
            } else {
              Alert.alert('Error', result.error);
            }
          },
        },
      ]);
    },
    [id, invalidate],
  );

  const handleReject = useCallback(
    (applicant: PermanentApplicant) => {
      Alert.alert('Reject?', `Reject ${applicant.display_name}? This cannot be undone.`, [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reject',
          style: 'destructive',
          onPress: async () => {
            const result = await apiPost(`/api/permanent/${id}/applicants/${applicant.crew_person_id}/reject`);
            if (result.ok) invalidate();
            else Alert.alert('Error', result.error);
          },
        },
      ]);
    },
    [id, invalidate],
  );

  const handleSelect = useCallback(
    (applicant: PermanentApplicant) => {
      Alert.alert(
        'Select for negotiation?',
        `Select ${applicant.display_name} for negotiation? This will open a message thread.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Select',
            onPress: async () => {
              const result = await apiPost(`/api/permanent/${id}/applicants/${applicant.crew_person_id}/select`);
              if (result.ok) {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                invalidate();
                Alert.alert('Selected', `${applicant.display_name} selected for negotiation. Chat available in Phase 4.`, [
                  { text: 'OK', onPress: () => router.back() },
                ]);
              } else {
                Alert.alert('Error', result.error);
              }
            },
          },
        ],
      );
    },
    [id, invalidate],
  );

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await invalidate();
    setRefreshing(false);
  }, [invalidate]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f9fafb' }}>
      <View style={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 8 }}>
        <Pressable onPress={() => router.back()}>
          <Text style={{ fontSize: 14, color: '#2563eb' }}>← Back to My Jobs</Text>
        </Pressable>
        <Text style={{ fontSize: 20, fontWeight: 'bold', color: '#111', marginTop: 4 }}>Review Applicants</Text>

        {data && (
          <Text style={{ fontSize: 13, color: '#6b7280', marginTop: 2 }}>
            {data.shortlist_count}/{data.shortlist_cap} shortlisted
          </Text>
        )}

        {/* Negotiation banner */}
        {data?.selected_crew_id && (
          <View style={{ backgroundColor: '#eff6ff', borderRadius: 8, padding: 10, marginTop: 8 }}>
            <Text style={{ fontSize: 13, color: '#2563eb', fontWeight: '600' }}>
              Currently in negotiation with {data.applicants.find((a) => a.crew_person_id === data.selected_crew_id)?.display_name ?? 'a candidate'}
            </Text>
          </View>
        )}

        {/* Tab bar */}
        <View style={{ flexDirection: 'row', backgroundColor: '#e5e7eb', borderRadius: 8, padding: 2, marginTop: 8 }}>
          {([
            { key: 'applicants', label: `Applicants (${applied.length})` },
            { key: 'shortlisted', label: `Shortlisted (${shortlisted.length})` },
          ] as const).map((t) => (
            <Pressable
              key={t.key}
              onPress={() => setTab(t.key)}
              style={{
                flex: 1, paddingVertical: 6, borderRadius: 6, alignItems: 'center',
                backgroundColor: tab === t.key ? '#fff' : 'transparent',
              }}
            >
              <Text style={{ fontSize: 13, fontWeight: tab === t.key ? '600' : '400', color: tab === t.key ? '#111' : '#6b7280' }}>
                {t.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {isLoading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <Text style={{ color: '#9ca3af' }}>Loading...</Text>
        </View>
      ) : (
        <FlashList
          data={tab === 'applicants' ? applied : shortlisted}
          keyExtractor={(a) => a.id}
          renderItem={({ item }) => (
            <View style={{ paddingHorizontal: 16 }}>
              {tab === 'applicants' ? (
                <ApplicantRow applicant={item} onShortlist={handleShortlist} onReject={handleReject} />
              ) : (
                <ApplicantRow applicant={item} onSelect={handleSelect} onReject={handleReject} canSelect={canSelect} />
              )}
            </View>
          )}
          estimatedItemSize={160}
          contentContainerStyle={{ paddingBottom: 16 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
          ListEmptyComponent={
            <View style={{ paddingTop: 60, alignItems: 'center' }}>
              <Text style={{ fontSize: 16, color: '#9ca3af' }}>
                {tab === 'applicants' ? 'No pending applicants' : 'No shortlisted candidates'}
              </Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}
