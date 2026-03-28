import { useState, useCallback, useMemo } from 'react';
import { View, Text, Pressable, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FlashList } from '@shopify/flash-list';
import { router } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/lib/auth-context';
import { useMyDayworks, type MyDaywork } from '@/hooks/use-my-dayworks';
import { useMyPermanent, type MyPermanent } from '@/hooks/use-my-permanent';
import { currencySymbol } from '@dockwalker/shared';

type TabName = 'active' | 'in_progress' | 'done' | 'templates';

type AnyPosting = { type: 'daywork'; data: MyDaywork } | { type: 'permanent'; data: MyPermanent };

export default function MyJobsScreen() {
  const [tab, setTab] = useState<TabName>('active');
  const [refreshing, setRefreshing] = useState(false);
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const dayworks = useMyDayworks();
  const permanent = useMyPermanent();
  const isLoading = dayworks.isLoading || permanent.isLoading;

  const allDayworks = dayworks.data?.dayworks ?? [];
  const allPermanent = permanent.data?.postings ?? [];

  const activeItems = useMemo<AnyPosting[]>(() => [
    ...allDayworks
      .filter((d) => d.status === 'active' && d.positions_filled < d.positions_available)
      .map((d) => ({ type: 'daywork' as const, data: d })),
    ...allPermanent
      .filter((p) => p.status === 'active')
      .map((p) => ({ type: 'permanent' as const, data: p })),
  ], [allDayworks, allPermanent]);

  const inProgressItems = useMemo<AnyPosting[]>(() => [
    ...allDayworks
      .filter((d) => d.status === 'in_progress' || (d.status === 'active' && d.positions_filled > 0))
      .map((d) => ({ type: 'daywork' as const, data: d })),
    ...allPermanent
      .filter((p) => p.status === 'in_negotiation')
      .map((p) => ({ type: 'permanent' as const, data: p })),
  ], [allDayworks, allPermanent]);

  const doneItems = useMemo<AnyPosting[]>(() => [
    ...allDayworks
      .filter((d) => d.status === 'completed' || d.status === 'cancelled')
      .map((d) => ({ type: 'daywork' as const, data: d })),
    ...allPermanent
      .filter((p) => p.status === 'filled' || p.status === 'cancelled')
      .map((p) => ({ type: 'permanent' as const, data: p })),
  ], [allDayworks, allPermanent]);

  const items = tab === 'active' ? activeItems : tab === 'in_progress' ? inProgressItems : doneItems;

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['my-dayworks', user?.id] }),
      queryClient.invalidateQueries({ queryKey: ['my-permanent', user?.id] }),
    ]);
    setRefreshing(false);
  }, [queryClient, user?.id]);

  const handlePostingPress = useCallback((item: AnyPosting) => {
    if (item.type === 'daywork') {
      router.push(`/(app)/daywork/${item.data.id}/review`);
    } else {
      router.push(`/(app)/permanent/${item.data.id}/review`);
    }
  }, []);

  function renderPostingCard(item: AnyPosting) {
    const isDw = item.type === 'daywork';
    const d = item.data;
    const vessel = d.vessels;
    const vesselName = vessel
      ? vessel.nda_flag ? 'NDA Vessel' : `${vessel.vessel_type === 'motor' ? 'M/Y' : 'S/Y'} ${vessel.name}`
      : 'Vessel TBD';
    const isDone = tab === 'done';

    return (
      <Pressable
        onPress={() => !isDone && handlePostingPress(item)}
        style={{
          backgroundColor: '#fff',
          borderRadius: 12,
          borderWidth: 1,
          borderColor: '#e5e7eb',
          padding: 14,
          marginBottom: 10,
          opacity: isDone ? 0.5 : 1,
        }}
      >
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
          <Text style={{ fontSize: 15, fontWeight: 'bold', color: '#111', flex: 1 }} numberOfLines={1}>
            {d.yacht_roles?.name ?? 'Role TBD'}
          </Text>
          <Text style={{ fontSize: 11, color: '#9ca3af' }}>
            {isDw ? 'DW' : 'PM'}-{String(d.job_number).padStart(5, '0')}
          </Text>
        </View>

        <Text style={{ fontSize: 13, color: '#4b5563', marginBottom: 2 }}>{vesselName}</Text>
        <Text style={{ fontSize: 13, color: '#6b7280', marginBottom: 6 }}>{d.ports?.name ?? ''}</Text>

        {isDw ? (
          <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#111' }}>
            {currencySymbol((d as MyDaywork).currency)}{(d as MyDaywork).day_rate}/day
          </Text>
        ) : (
          <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#111' }}>
            {currencySymbol((d as MyPermanent).salary_currency)}
            {((d as MyPermanent).salary_max ?? (d as MyPermanent).salary_min)?.toLocaleString()}
            /{(d as MyPermanent).salary_period === 'annual' ? 'yr' : 'mo'}
          </Text>
        )}

        <View style={{ flexDirection: 'row', gap: 8, marginTop: 6 }}>
          {isDw && (
            <View style={{ backgroundColor: '#f3f4f6', borderRadius: 10, paddingHorizontal: 6, paddingVertical: 2 }}>
              <Text style={{ fontSize: 11, color: '#4b5563' }}>
                {(d as MyDaywork).positions_filled}/{(d as MyDaywork).positions_available} filled
              </Text>
            </View>
          )}
          {!isDw && (d as MyPermanent).applicant_count > 0 && (
            <View style={{ backgroundColor: '#eff6ff', borderRadius: 10, paddingHorizontal: 6, paddingVertical: 2 }}>
              <Text style={{ fontSize: 11, color: '#2563eb' }}>
                {(d as MyPermanent).applicant_count} applicant{(d as MyPermanent).applicant_count !== 1 ? 's' : ''}
              </Text>
            </View>
          )}
          {tab === 'in_progress' && (
            <View style={{ backgroundColor: '#f0fdf4', borderRadius: 10, paddingHorizontal: 6, paddingVertical: 2 }}>
              <Text style={{ fontSize: 11, color: '#15803d' }}>Go to chat</Text>
            </View>
          )}
        </View>
      </Pressable>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f9fafb' }}>
      <View style={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 8 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <Text style={{ fontSize: 20, fontWeight: 'bold', color: '#111' }}>My Jobs</Text>
          <Pressable
            onPress={() => router.push('/(app)/post')}
            style={{ backgroundColor: '#2563eb', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 6 }}
          >
            <Text style={{ color: '#fff', fontWeight: '600', fontSize: 13 }}>+ Post</Text>
          </Pressable>
        </View>

        {/* Tab bar */}
        <View style={{ flexDirection: 'row', backgroundColor: '#e5e7eb', borderRadius: 8, padding: 2 }}>
          {([
            { key: 'active', label: 'Active' },
            { key: 'in_progress', label: 'In Progress' },
            { key: 'done', label: 'Done' },
            { key: 'templates', label: 'Templates' },
          ] as const).map((t) => (
            <Pressable
              key={t.key}
              onPress={() => setTab(t.key)}
              style={{
                flex: 1, paddingVertical: 6, borderRadius: 6, alignItems: 'center',
                backgroundColor: tab === t.key ? '#fff' : 'transparent',
              }}
            >
              <Text style={{
                fontSize: 11, fontWeight: tab === t.key ? '600' : '400',
                color: tab === t.key ? '#111' : '#6b7280',
              }}>
                {t.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {tab === 'templates' ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <Text style={{ fontSize: 16, color: '#9ca3af' }}>Templates coming soon</Text>
        </View>
      ) : (
        <FlashList
          data={items}
          keyExtractor={(item) => `${item.type}-${item.data.id}`}
          renderItem={({ item }) => renderPostingCard(item)}
          estimatedItemSize={120}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 16 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
          ListEmptyComponent={
            <View style={{ paddingTop: 60, alignItems: 'center' }}>
              <Text style={{ fontSize: 16, color: '#9ca3af' }}>
                {isLoading ? 'Loading...' : 'No postings yet'}
              </Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}
