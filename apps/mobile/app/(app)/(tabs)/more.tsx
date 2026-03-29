import { View, Text, Pressable, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import Constants from 'expo-constants';
import { useAuth } from '@/lib/auth-context';
import { Card, colors } from '@/components/ui';

function MenuItem({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={{ paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#f3f4f6', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
      <Text style={{ fontSize: 15, color: '#111' }}>{label}</Text>
      <Text style={{ fontSize: 14, color: '#9ca3af' }}>→</Text>
    </Pressable>
  );
}

export default function MoreScreen() {
  const { person, signOut } = useAuth();
  const isEmployerOrAgent = person?.current_hat === 'employer' || person?.current_hat === 'agent';
  const appVersion = Constants.expoConfig?.version ?? '1.0.0';

  const handleSignOut = () => {
    Alert.alert('Sign out?', 'You will need to sign in again.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: () => signOut() },
    ]);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f9fafb' }}>
      <View style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 }}>
        <Text style={{ fontSize: 20, fontWeight: 'bold', color: '#111' }}>More</Text>
      </View>

      <View style={{ paddingHorizontal: 16 }}>
        <Card>
          <MenuItem label="🛟  Docky AI Advisor" onPress={() => router.push('/(app)/docky')} />
          <MenuItem label="⚙️  Settings" onPress={() => router.push('/(app)/settings')} />
          <MenuItem label="💳  Billing" onPress={() => router.push('/(app)/billing')} />
          {isEmployerOrAgent && (
            <MenuItem label="🚢  My Vessels" onPress={() => router.push('/(app)/vessels')} />
          )}
          <Pressable onPress={handleSignOut} style={{ paddingVertical: 14, flexDirection: 'row', alignItems: 'center' }}>
            <Text style={{ fontSize: 15, color: '#dc2626' }}>Sign out</Text>
          </Pressable>
        </Card>
      </View>

      <View style={{ position: 'absolute', bottom: 30, left: 0, right: 0, alignItems: 'center' }}>
        <Text style={{ fontSize: 12, color: '#9ca3af' }}>DockWalker v{appVersion}</Text>
      </View>
    </SafeAreaView>
  );
}
