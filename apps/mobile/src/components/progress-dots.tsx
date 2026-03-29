import { View } from 'react-native';

interface ProgressDotsProps {
  current: number;
  total: number;
}

export function ProgressDots({ current, total }: ProgressDotsProps) {
  return (
    <View className="flex-row justify-center gap-2 py-4">
      {Array.from({ length: total }, (_, i) => (
        <View
          key={i}
          className={`w-2 h-2 rounded-full ${
            i === current ? 'bg-blue-600' : i < current ? 'bg-blue-300' : 'bg-gray-300'
          }`}
        />
      ))}
    </View>
  );
}
