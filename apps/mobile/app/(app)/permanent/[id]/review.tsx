import { useState, useCallback, useMemo } from 'react';
import { View, Text, Alert, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { FlashList } from '@shopify/flash-list';
import * as Haptics from 'expo-haptics';
import { usePermanentApplicants, type PermanentApplicant } from '@/hooks/use-permanent-applicants';
import { PermanentApplicantRow } from '@/components/permanent-applicant-row';
import { apiPost } from '@/lib/api';
import { ScreenHeader, TabBar, EmptyState, colors } from '@/components/ui';

type Tab = 'applicants' | 'shortlisted';

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

  const tabs = useMemo(() => [
    { key: 'applicants', label: `Applicants (${applied.length})` },
    { key: 'shortlisted', label: `Shortlisted (${shortlisted.length})` },
  ], [applied.length, shortlisted.length]);

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
      <ScreenHeader
        title="Review Applicants"
        subtitle={data ? `${data.shortlist_count}/${data.shortlist_cap} shortlisted` : undefined}
        onBack={() => router.back()}
        backLabel="← Back to My Jobs"
      />

      <View style={{ paddingHorizontal: 16, paddingBottom: 8 }}>
        {data?.selected_crew_id && (
          <View style={{ backgroundColor: '#eff6ff', borderRadius: 8, padding: 10, marginBottom: 8 }}>
            <Text style={{ fontSize: 13, color: colors.primary, fontWeight: '600' }}>
              Currently in negotiation with {data.applicants.find((a) => a.crew_person_id === data.selected_crew_id)?.display_name ?? 'a candidate'}
            </Text>
          </View>
        )}

        <TabBar tabs={tabs} activeTab={tab} onChange={(k) => setTab(k as Tab)} />
      </View>

      {isLoading ? (
        <EmptyState message="Loading..." />
      ) : (
        <FlashList
          data={tab === 'applicants' ? applied : shortlisted}
          keyExtractor={(a) => a.id}
          renderItem={({ item }) => (
            <View style={{ paddingHorizontal: 16 }}>
              {tab === 'applicants' ? (
                <PermanentApplicantRow applicant={item} onShortlist={handleShortlist} onReject={handleReject} />
              ) : (
                <PermanentApplicantRow applicant={item} onSelect={handleSelect} onReject={handleReject} canSelect={canSelect} />
              )}
            </View>
          )}
          estimatedItemSize={160}
          contentContainerStyle={{ paddingBottom: 16 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
          ListEmptyComponent={
            <EmptyState message={tab === 'applicants' ? 'No pending applicants' : 'No shortlisted candidates'} />
          }
        />
      )}
    </SafeAreaView>
  );
}
