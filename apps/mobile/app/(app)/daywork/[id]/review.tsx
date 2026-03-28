import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { View, Text, Pressable, Alert, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { FlashList } from '@shopify/flash-list';
import * as Haptics from 'expo-haptics';
import { SwipeCardStack } from '@/components/swipe-card-stack';
import { ApplicantCard } from '@/components/applicant-card';
import { useDayworkApplicants, type Applicant } from '@/hooks/use-daywork-applicants';
import { apiPost } from '@/lib/api';

type Tab = 'applicants' | 'shortlisted';

export default function DayworkReviewScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, isLoading, invalidate } = useDayworkApplicants(id);
  const [tab, setTab] = useState<Tab>('applicants');
  const [refreshing, setRefreshing] = useState(false);
  const viewedRef = useRef<Set<string>>(new Set());

  const pending = useMemo(
    () => (data?.applicants ?? []).filter((a) => a.status === 'applied' || a.status === 'viewed'),
    [data],
  );
  const shortlisted = useMemo(
    () => (data?.applicants ?? []).filter((a) => a.status === 'shortlisted'),
    [data],
  );

  // Auto-view: mark top card as viewed
  useEffect(() => {
    if (pending.length === 0) return;
    const top = pending[0];
    if (top.status === 'applied' && !viewedRef.current.has(top.crew_person_id)) {
      viewedRef.current.add(top.crew_person_id);
      apiPost(`/api/daywork/${id}/applicants/${top.crew_person_id}/view`);
    }
  }, [pending, id]);

  const handleAccept = useCallback(
    (applicant: Applicant) => {
      const name = applicant.profiles?.display_name ?? 'this applicant';
      Alert.alert(
        'Accept applicant?',
        `Accept ${name}? This will open a message thread.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Accept',
            onPress: async () => {
              const result = await apiPost(`/api/daywork/${id}/applicants/${applicant.crew_person_id}/accept`);
              if (result.ok) {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                invalidate();
                Alert.alert('Accepted', `${name} has been accepted. Chat will be available in Phase 4.`, [
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

  const handleReject = useCallback(
    (applicant: Applicant) => {
      const name = applicant.profiles?.display_name ?? 'this applicant';
      Alert.alert(
        'Reject applicant?',
        `Reject ${name}? This cannot be undone.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Reject',
            style: 'destructive',
            onPress: async () => {
              const result = await apiPost(`/api/daywork/${id}/applicants/${applicant.crew_person_id}/reject`);
              if (result.ok) {
                invalidate();
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

  const handleShortlist = useCallback(
    async (applicant: Applicant) => {
      const result = await apiPost(`/api/daywork/${id}/applicants/${applicant.crew_person_id}/shortlist`);
      if (result.ok) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        invalidate();
      } else {
        Alert.alert('Error', result.error);
      }
    },
    [id, invalidate],
  );

  const handleSwipeRight = useCallback(
    (applicant: Applicant) => handleAccept(applicant),
    [handleAccept],
  );

  const handleSwipeLeft = useCallback(
    (applicant: Applicant) => handleReject(applicant),
    [handleReject],
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

        {/* Positions indicator */}
        {data && (
          <Text style={{ fontSize: 13, color: '#6b7280', marginTop: 2 }}>
            {data.positions_filled}/{data.positions_available} positions filled
          </Text>
        )}

        {/* Tab bar */}
        <View style={{ flexDirection: 'row', backgroundColor: '#e5e7eb', borderRadius: 8, padding: 2, marginTop: 8 }}>
          {([
            { key: 'applicants', label: `Applicants (${pending.length})` },
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
      ) : tab === 'applicants' ? (
        <View style={{ flex: 1, paddingHorizontal: 16, paddingBottom: 8 }}>
          <SwipeCardStack
            items={pending}
            keyExtractor={(a) => a.id}
            renderCard={(a) => <ApplicantCard applicant={a} />}
            onSwipeRight={handleSwipeRight}
            onSwipeLeft={handleSwipeLeft}
            onCardPress={(a) => handleShortlist(a)}
            emptyComponent={
              <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                <Text style={{ fontSize: 16, color: '#9ca3af' }}>No pending applicants</Text>
              </View>
            }
          />
        </View>
      ) : (
        <FlashList
          data={shortlisted}
          keyExtractor={(a) => a.id}
          renderItem={({ item }) => (
            <View style={{ marginBottom: 10, paddingHorizontal: 16 }}>
              <View style={{ backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#e5e7eb', padding: 12 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                  <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#e5e7eb', alignItems: 'center', justifyContent: 'center', marginRight: 10 }}>
                    <Text style={{ fontSize: 14, color: '#9ca3af' }}>{(item.profiles?.display_name ?? '?')[0].toUpperCase()}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 15, fontWeight: '600', color: '#111' }}>{item.profiles?.display_name ?? 'Unknown'}</Text>
                    <Text style={{ fontSize: 12, color: '#6b7280' }}>{item.profiles?.yacht_roles?.name ?? ''}</Text>
                  </View>
                </View>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <Pressable
                    onPress={() => handleAccept(item)}
                    style={{ flex: 1, backgroundColor: '#2563eb', borderRadius: 8, paddingVertical: 8, alignItems: 'center' }}
                  >
                    <Text style={{ color: '#fff', fontWeight: '600', fontSize: 13 }}>Accept</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => handleReject(item)}
                    style={{ flex: 1, backgroundColor: '#fef2f2', borderRadius: 8, paddingVertical: 8, alignItems: 'center' }}
                  >
                    <Text style={{ color: '#dc2626', fontWeight: '600', fontSize: 13 }}>Reject</Text>
                  </Pressable>
                </View>
              </View>
            </View>
          )}
          estimatedItemSize={120}
          contentContainerStyle={{ paddingBottom: 16 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
          ListEmptyComponent={
            <View style={{ paddingTop: 60, alignItems: 'center' }}>
              <Text style={{ fontSize: 16, color: '#9ca3af' }}>No shortlisted applicants</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}
