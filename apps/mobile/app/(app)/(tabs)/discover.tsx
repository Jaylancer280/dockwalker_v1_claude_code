import { useState, useCallback, useMemo } from 'react';
import { View, Text, Pressable, RefreshControl, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FlashList } from '@shopify/flash-list';
import * as Haptics from 'expo-haptics';
import { SwipeCardStack } from '@/components/swipe-card-stack';
import { DayworkJobCard, DayworkJobCardSkeleton } from '@/components/daywork-job-card';
import { PermanentJobCard } from '@/components/permanent-job-card';
import { JobDetailSheet } from '@/components/job-detail-sheet';
import { DiscoverFilterPanel, ActiveFilterPills } from '@/components/discover-filters';
import { AvailabilityOverlay } from '@/components/availability-overlay';
import { useDayworkDiscover, type HydratedDaywork, type DiscoverFilters } from '@/hooks/use-daywork-discover';
import { useAvailability } from '@/hooks/use-availability';
import { usePermanentDiscover, type HydratedPermanent } from '@/hooks/use-permanent-discover';
import { apiPost } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';

type DiscoverMode = 'daywork' | 'permanent';

export default function DiscoverScreen() {
  const { person } = useAuth();
  const [mode, setMode] = useState<DiscoverMode>('daywork');
  const [selectedDaywork, setSelectedDaywork] = useState<HydratedDaywork | null>(null);
  const [isApplying, setIsApplying] = useState(false);
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
    Alert.alert(
      posting.role_name ?? 'Job Details',
      `PM-${String(posting.job_number).padStart(5, '0')}\n${posting.poster_name ?? 'Unknown poster'}`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Apply',
          onPress: async () => {
            const result = await apiPost(`/api/permanent/${posting.id}/apply`);
            if (result.ok) {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              permanent.refetch();
            } else {
              Alert.alert('Could not apply', result.error);
            }
          },
        },
      ],
    );
  }, [permanent]);

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
              backgroundColor: Object.values(filters).some(Boolean) ? '#2563eb' : '#f3f4f6',
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

        {/* Segmented toggle */}
        <View style={{ flexDirection: 'row', backgroundColor: '#e5e7eb', borderRadius: 8, padding: 2 }}>
          {(['daywork', 'permanent'] as const).map((m) => (
            <Pressable
              key={m}
              onPress={() => setMode(m)}
              style={{
                flex: 1,
                paddingVertical: 6,
                borderRadius: 6,
                alignItems: 'center',
                backgroundColor: mode === m ? '#fff' : 'transparent',
              }}
            >
              <Text style={{
                fontSize: 13,
                fontWeight: mode === m ? '600' : '400',
                color: mode === m ? '#111' : '#6b7280',
              }}>
                {m === 'daywork' ? 'Daywork' : 'Permanent'}
              </Text>
            </Pressable>
          ))}
        </View>
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
                <Pressable
                  onPress={handleRefresh}
                  style={{ backgroundColor: '#2563eb', borderRadius: 8, paddingHorizontal: 16, paddingVertical: 8 }}
                >
                  <Text style={{ color: '#fff', fontWeight: '600' }}>Refresh</Text>
                </Pressable>
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
                <Pressable
                  onPress={handleRefresh}
                  style={{ backgroundColor: '#2563eb', borderRadius: 8, paddingHorizontal: 16, paddingVertical: 8 }}
                >
                  <Text style={{ color: '#fff', fontWeight: '600' }}>Refresh</Text>
                </Pressable>
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
