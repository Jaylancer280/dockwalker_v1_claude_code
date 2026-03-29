import { View, Text, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, Redirect } from 'expo-router';
import { useAuth } from '@/lib/auth-context';
import { ScreenHeader, Card } from '@/components/ui';

export default function PostTypeSelector() {
  const { person } = useAuth();

  if (person?.current_hat === 'crew') {
    return <Redirect href="/(app)/(tabs)/discover" />;
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f9fafb' }}>
      <ScreenHeader
        title="Post a job"
        subtitle="What type of position are you hiring for?"
        onBack={() => router.back()}
      />

      <View style={{ paddingHorizontal: 16, gap: 12 }}>
        <Pressable onPress={() => router.push('/(app)/post-daywork')}>
          <Card style={{ padding: 20, borderWidth: 2, borderRadius: 16 }}>
            <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#111', marginBottom: 4 }}>
              Daywork
            </Text>
            <Text style={{ fontSize: 14, color: '#6b7280' }}>
              Short-term cover, 1-14 days
            </Text>
          </Card>
        </Pressable>

        <Pressable onPress={() => router.push('/(app)/post-permanent')}>
          <Card style={{ padding: 20, borderWidth: 2, borderRadius: 16 }}>
            <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#111', marginBottom: 4 }}>
              Permanent
            </Text>
            <Text style={{ fontSize: 14, color: '#6b7280' }}>
              Long-term position, structured hiring
            </Text>
          </Card>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
