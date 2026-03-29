import { useState, useCallback, useMemo } from 'react';
import { View, Text, Pressable, RefreshControl, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FlashList } from '@shopify/flash-list';
import * as Haptics from 'expo-haptics';
import { useMMKVString } from 'react-native-mmkv';
import { SwipeCardStack } from '@/components/swipe-card-stack';
import { DayworkJobCard, DayworkJobCardSkeleton } from '@/components/daywork-job-card';
import { PermanentJobCard } from '@/components/permanent-job-card';
import { JobDetailSheet } from '@/components/job-detail-sheet';
import { PermanentDetailSheet } from '@/components/permanent-detail-sheet';
import { DiscoverFilterPanel, ActiveFilterPills } from '@/components/discover-filters';
import { AvailabilityOverlay } from '@/components/availability-overlay';
import { useDayworkDiscover, type HydratedDaywork, type DiscoverFilters } from '@/hooks/use-daywork-discover';
import { useAvailability } from '@/hooks/use-availability';
import { useCrewProfile } from '@/hooks/use-crew-profile';
import { usePermanentDiscover, type HydratedPermanent } from '@/hooks/use-permanent-discover';
import { apiPost } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { TabBar, Button, colors } from '@/components/ui';

type DiscoverMode = 'daywork' | 'permanent';

const DISCOVER_TABS = [
  { key: 'daywork', label: 'Daywork' },
  { key: 'permanent', label: 'Permanent' },
];

export default function DiscoverScreen() {
  const { person } = useAuth();
  const [storedMode, setStoredMode] = useMMKVString('discover-mode');
  const mode: DiscoverMode = (storedMode as DiscoverMode) || 'daywork';
  const setMode = (m: DiscoverMode) => setStoredMode(m);
  const [selectedDaywork, setSelectedDaywork] = useState<HydratedDaywork | null>(null);
  const [selectedPermanent, setSelectedPermanent] = useState<HydratedPermanent | null>(null);
  const [isApplying, setIsApplying] = useState(false);
  const crewProfile = useCrewProfile();
  const [refreshing, setRefreshing] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [showAvailability, setShowAvailability] = useState(false);
  const [pendingApplyId, setPendingApplyId] = useState<string | null>(null);
  const [filters, setFilters] = useState<DiscoverFilters>({});
  const availability = useAvailability();

  // Daywork
  const daywork = useDayworkDiscover(filters);
  const dayworkCards = daywork.data ?? [];

  // Permanent
  const permanent = usePermanentDiscover(filters);
  const permanentPostings = useMemo(
    () => permanent.data?.pages.flatMap((p) => p.postings) ?? [],
    [permanent.data],
  );

  const handleDayworkApply = useCallback(
    async (dayworkId: string, message?: string) => {
      // Check availability gate
      if (availability.data?.status !== 'available') {
        setPendingApplyId(dayworkId);
        setShowAvailability(true);
        return;
      }

      setIsApplying(true);
      const body: Record<string, unknown> = {};
      if (message) body.message = message;

      const result = await apiPost(`/api/daywork/${dayworkId}/apply`, body);
      setIsApplying(false);

      if (result.ok) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        daywork.removeCard(dayworkId);
        setSelectedDaywork(null);
      } else {
        Alert.alert('Could not apply', result.error);
      }
    },
    [daywork, availability.data],
  );

  const handleSwipeRight = useCallback(
    (item: HydratedDaywork) => { handleDayworkApply(item.id); },
    [handleDayworkApply],
  );

  const handleSwipeLeft = useCallback(
    (item: HydratedDaywork) => { daywork.removeCard(item.id); },
    [daywork],
  );

  const handlePermanentPress = useCallback((posting: HydratedPermanent) => {
    setSelectedPermanent(posting);
  }, []);

  const handlePermanentApply = useCallback(
    async (postingId: string, message?: string) => {
      setIsApplying(true);
      const body: Record<string, unknown> = {};
      if (message) body.message = message;

      const result = await apiPost(`/api/permanent/${postingId}/apply`, body);
      setIsApplying(false);

      if (result.ok) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setSelectedPermanent(null);
        permanent.refetch();
      } else {
        Alert.alert('Could not apply', result.error);
      }
    },
    [permanent],
  );

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (mode === 'daywork') {
      await daywork.refetch();
    } else {
      await permanent.refetch();
    }
    setRefreshing(false);
  }, [mode, daywork, permanent]);

  const isLoading = mode === 'daywork' ? daywork.isLoading : permanent.isLoading;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f9fafb' }}>
      {/* Header + toggle */}
      <View style={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 8 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <Text style={{ fontSize: 20, fontWeight: 'bold', color: '#111' }}>Discover</Text>
          <Pressable
            onPress={() => setShowFilters(true)}
            style={{
              paddingHorizontal: 12,
              paddingVertical: 6,
              borderRadius: 8,
              backgroundColor: Object.values(filters).some(Boolean) ? colors.primary : '#f3f4f6',
            }}
          >
            <Text style={{
              fontSize: 13,
              fontWeight: '600',
              color: Object.values(filters).some(Boolean) ? '#fff' : '#4b5563',
            }}>
              Filters{Object.values(filters).filter(Boolean).length > 0 ? ` (${Object.values(filters).filter(Boolean).length})` : ''}
            </Text>
          </Pressable>
        </View>

        <TabBar tabs={DISCOVER_TABS} activeTab={mode} onChange={(k) => setMode(k as DiscoverMode)} />
      </View>

      {/* Active filter pills */}
      <ActiveFilterPills
        filters={filters}
        onClear={(key) => setFilters((f) => ({ ...f, [key]: undefined }))}
      />

      {/* Content */}
      {isLoading ? (
        <View style={{ flex: 1, padding: 16 }}>
          <DayworkJobCardSkeleton />
        </View>
      ) : mode === 'daywork' ? (
        <View style={{ flex: 1, paddingHorizontal: 16, paddingBottom: 8 }}>
          <SwipeCardStack
            items={dayworkCards}
            keyExtractor={(c) => c.id}
            renderCard={(c) => <DayworkJobCard card={c} />}
            onSwipeRight={handleSwipeRight}
            onSwipeLeft={handleSwipeLeft}
            onCardPress={(c) => setSelectedDaywork(c)}
            emptyComponent={
              <ScrollView
                contentContainerStyle={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
              >
                <Text style={{ fontSize: 18, color: '#6b7280', marginBottom: 8 }}>
                  No more daywork in your area
                </Text>
                <Button variant="primary" size="md" label="Refresh" onPress={handleRefresh} />
              </ScrollView>
            }
          />
        </View>
      ) : (
        <View style={{ flex: 1 }}>
          <FlashList
            data={permanentPostings}
            keyExtractor={(p) => p.id}
            renderItem={({ item }) => (
              <PermanentJobCard posting={item} onPress={handlePermanentPress} />
            )}
            estimatedItemSize={180}
            contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 16 }}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
            onEndReached={() => {
              if (permanent.hasNextPage && !permanent.isFetchingNextPage) {
                permanent.fetchNextPage();
              }
            }}
            onEndReachedThreshold={0.5}
            ListEmptyComponent={
              <View style={{ paddingTop: 60, alignItems: 'center' }}>
                <Text style={{ fontSize: 18, color: '#6b7280', marginBottom: 8 }}>
                  No permanent positions available
                </Text>
                <Button variant="primary" size="md" label="Refresh" onPress={handleRefresh} />
              </View>
            }
          />
        </View>
      )}

      {/* Daywork detail sheet */}
      <JobDetailSheet
        job={selectedDaywork}
        onApply={handleDayworkApply}
        onDismiss={() => setSelectedDaywork(null)}
        isApplying={isApplying}
      />

      {/* Permanent detail sheet */}
      <PermanentDetailSheet
        posting={selectedPermanent}
        crewCertIds={crewProfile.data?.certification_ids ?? []}
        onApply={handlePermanentApply}
        onDismiss={() => setSelectedPermanent(null)}
        isApplying={isApplying}
      />

      {/* Availability overlay */}
      {showAvailability && (
        <AvailabilityOverlay
          onDismiss={() => {
            setShowAvailability(false);
            setPendingApplyId(null);
          }}
          onAvailabilitySet={() => {
            setShowAvailability(false);
            if (pendingApplyId) {
              handleDayworkApply(pendingApplyId);
              setPendingApplyId(null);
            }
          }}
        />
      )}

      {/* Filter panel */}
      {showFilters && (
        <DiscoverFilterPanel
          filters={filters}
          onApply={(f) => {
            setFilters(f);
            setShowFilters(false);
          }}
          onDismiss={() => setShowFilters(false)}
          mode={mode}
        />
      )}
    </SafeAreaView>
  );
}
