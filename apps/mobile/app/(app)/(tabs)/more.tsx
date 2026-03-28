import { View, Text, Pressable } from 'react-native';
import { useAuth } from '@/lib/auth-context';

export default function MoreScreen() {
  const { person, signOut } = useAuth();

  return (
    <View className="flex-1 items-center justify-center bg-white">
      <Text className="text-xl font-bold mb-2">More</Text>
      <Text className="text-gray-500 mb-6">Hat: {person?.current_hat}</Text>

      <Pressable
        className="bg-red-500 rounded-lg px-6 py-3"
        onPress={signOut}
      >
        <Text className="text-white font-semibold">Sign out</Text>
      </Pressable>
    </View>
  );
}
