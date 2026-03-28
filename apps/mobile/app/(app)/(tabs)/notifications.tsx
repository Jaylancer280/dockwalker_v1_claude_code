import { View, Text } from 'react-native';
import { useAuth } from '@/lib/auth-context';

export default function NotificationsScreen() {
  const { person } = useAuth();

  return (
    <View className="flex-1 items-center justify-center bg-white">
      <Text className="text-xl font-bold mb-2">Notifications</Text>
      <Text className="text-gray-500">Hat: {person?.current_hat}</Text>
    </View>
  );
}
