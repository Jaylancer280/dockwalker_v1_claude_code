import { useState, useCallback } from 'react';
import { View, Text, Pressable, RefreshControl, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FlashList } from '@shopify/flash-list';
import { router } from 'expo-router';
import { useVessels, type Vessel } from '@/hooks/use-vessels';
import { ScreenHeader, Card, Button, EmptyState, colors } from '@/components/ui';

export default function VesselsScreen() {
  const { data: vessels, isLoading, invalidate } = useVessels();
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await invalidate();
    setRefreshing(false);
  }, [invalidate]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f9fafb' }}>
      <ScreenHeader title="My Vessels" onBack={() => router.back()} />

      <FlashList
        data={vessels ?? []}
        keyExtractor={(v) => v.id}
        renderItem={({ item }) => {
          const prefix = item.vessel_type === 'motor' ? 'M/Y' : 'S/Y';
          return (
            <View style={{ paddingHorizontal: 16, marginBottom: 10 }}>
              <Pressable onPress={() => router.push(`/(app)/vessels/${item.id}/edit`)}>
                <Card>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 15, fontWeight: '600', color: '#111' }}>
                        {prefix} {item.name}
                      </Text>
                      <Text style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
                        IMO {item.imo_number}
                        {item.loa_meters ? ` · ${item.loa_meters}m` : ''}
                        {item.vessel_size_bands?.label ? ` · ${item.vessel_size_bands.label}` : ''}
                      </Text>
                    </View>
                    {item.nda_flag && (
                      <View style={{ backgroundColor: '#fef2f2', borderRadius: 10, paddingHorizontal: 6, paddingVertical: 2 }}>
                        <Text style={{ fontSize: 11, color: '#dc2626', fontWeight: '600' }}>NDA</Text>
                      </View>
                    )}
                  </View>
                </Card>
              </Pressable>
            </View>
          );
        }}
        estimatedItemSize={80}
        contentContainerStyle={{ paddingTop: 8, paddingBottom: 80 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
        ListEmptyComponent={
          <EmptyState message={isLoading ? 'Loading...' : 'No vessels yet'} />
        }
      />

      <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: 16, backgroundColor: '#f9fafb' }}>
        <Button variant="primary" label="+ Add Vessel" onPress={() => Alert.alert('Add Vessel', 'Use the post form vessel selector to add vessels')} />
      </View>
    </SafeAreaView>
  );
}
