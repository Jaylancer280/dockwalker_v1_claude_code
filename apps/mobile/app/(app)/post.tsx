import { View, Text, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useAuth } from '@/lib/auth-context';
import { Redirect } from 'expo-router';

export default function PostTypeSelector() {
  const { person } = useAuth();

  if (person?.current_hat === 'crew') {
    return <Redirect href="/(app)/(tabs)/discover" />;
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f9fafb' }}>
      <View style={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 16 }}>
        <Pressable onPress={() => router.back()}>
          <Text style={{ fontSize: 14, color: '#2563eb' }}>← Back</Text>
        </Pressable>
        <Text style={{ fontSize: 22, fontWeight: 'bold', color: '#111', marginTop: 12 }}>
          Post a job
        </Text>
        <Text style={{ fontSize: 14, color: '#6b7280', marginTop: 4 }}>
          What type of position are you hiring for?
        </Text>
      </View>

      <View style={{ paddingHorizontal: 16, gap: 12 }}>
        <Pressable
          onPress={() => router.push('/(app)/post-daywork')}
          style={({ pressed }) => ({
            backgroundColor: '#fff',
            borderRadius: 16,
            borderWidth: 2,
            borderColor: '#e5e7eb',
            padding: 20,
            opacity: pressed ? 0.95 : 1,
          })}
        >
          <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#111', marginBottom: 4 }}>
            Daywork
          </Text>
          <Text style={{ fontSize: 14, color: '#6b7280' }}>
            Short-term cover, 1-14 days
          </Text>
        </Pressable>

        <Pressable
          onPress={() => router.push('/(app)/post-permanent')}
          style={({ pressed }) => ({
            backgroundColor: '#fff',
            borderRadius: 16,
            borderWidth: 2,
            borderColor: '#e5e7eb',
            padding: 20,
            opacity: pressed ? 0.95 : 1,
          })}
        >
          <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#111', marginBottom: 4 }}>
            Permanent
          </Text>
          <Text style={{ fontSize: 14, color: '#6b7280' }}>
            Long-term position, structured hiring
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
