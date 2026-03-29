import { useState, useCallback } from 'react';
import { View, Text, Linking, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { apiGet, apiPost } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { ScreenHeader, Card, Button, EmptyState, Pill, colors } from '@/components/ui';

interface BillingStatus {
  plan: string;
  status: string | null;
  current_period_end?: string;
}

export default function BillingScreen() {
  const { user } = useAuth();
  const [managingPortal, setManagingPortal] = useState(false);

  const { data: billing, isLoading } = useQuery<BillingStatus>({
    queryKey: ['billing-status', user?.id],
    queryFn: async () => {
      const result = await apiGet<BillingStatus>('/api/billing/status');
      if (!result.ok) throw new Error(result.error);
      return result.data;
    },
    enabled: !!user,
  });

  const isPro = billing?.plan && billing.plan !== 'free';

  const handleSubscribe = useCallback(() => {
    Linking.openURL('https://dockwalker.io/billing');
  }, []);

  const handleManage = useCallback(async () => {
    setManagingPortal(true);
    const result = await apiPost<{ url: string }>('/api/billing/create-portal');
    setManagingPortal(false);
    if (result.ok) {
      Linking.openURL(result.data.url);
    } else {
      Alert.alert('Error', result.error);
    }
  }, []);

  if (isLoading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#f9fafb' }}>
        <ScreenHeader title="Billing" onBack={() => router.back()} />
        <EmptyState message="Loading..." />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f9fafb' }}>
      <ScreenHeader title="Billing" onBack={() => router.back()} />

      <View style={{ padding: 16, gap: 12 }}>
        {/* Current plan */}
        <Card>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ fontSize: 14, color: '#6b7280' }}>Current plan</Text>
            <Pill label={isPro ? billing!.plan : 'Free'} selected={!!isPro} />
          </View>
          {isPro && billing?.current_period_end && (
            <Text style={{ fontSize: 12, color: '#6b7280', marginTop: 6 }}>
              Renews {new Date(billing.current_period_end).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
            </Text>
          )}
        </Card>

        {/* Crew Free tier */}
        <Card>
          <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#111', marginBottom: 8 }}>Crew Free</Text>
          <View style={{ gap: 4 }}>
            <Text style={{ fontSize: 13, color: '#4b5563' }}>• Unlimited daywork applications</Text>
            <Text style={{ fontSize: 13, color: '#4b5563' }}>• Unlimited permanent applications</Text>
            <Text style={{ fontSize: 13, color: '#4b5563' }}>• 3 Docky questions/month</Text>
            <Text style={{ fontSize: 13, color: '#4b5563' }}>• Full profile + experience management</Text>
          </View>
        </Card>

        {/* Crew Pro tier */}
        <Card style={{ borderColor: colors.primary, borderWidth: 2 }}>
          <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#111', marginBottom: 8 }}>Crew Pro</Text>
          <View style={{ gap: 4, marginBottom: 12 }}>
            <Text style={{ fontSize: 13, color: '#4b5563' }}>• Everything in Free</Text>
            <Text style={{ fontSize: 13, color: '#4b5563' }}>• Unlimited Docky AI conversations</Text>
            <Text style={{ fontSize: 13, color: '#4b5563' }}>• Priority in employer search results</Text>
            <Text style={{ fontSize: 13, color: '#4b5563' }}>• Advanced career analytics</Text>
          </View>
          {isPro ? (
            <Button variant="secondary" label={managingPortal ? 'Opening...' : 'Manage subscription'} loading={managingPortal} onPress={handleManage} />
          ) : (
            <Button variant="primary" label="Subscribe on web" onPress={handleSubscribe} />
          )}
        </Card>

        <Text style={{ fontSize: 11, color: '#9ca3af', textAlign: 'center', marginTop: 4 }}>
          Subscriptions are managed through the DockWalker website.
        </Text>
      </View>
    </SafeAreaView>
  );
}
