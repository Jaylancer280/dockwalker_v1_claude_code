import { useState, useCallback } from 'react';
import { View, Text, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SwipeCardStack } from '@/components/swipe-card-stack';
import { DayworkJobCard, type DayworkCardData } from '@/components/daywork-job-card';

const MOCK_CARDS: DayworkCardData[] = Array.from({ length: 10 }, (_, i) => ({
  id: `mock-${i}`,
  job_number: 1001 + i,
  start_date: '2026-04-05',
  end_date: '2026-04-12',
  working_days: 6,
  day_rate: 200 + i * 25,
  currency: ['EUR', 'USD', 'GBP', 'AED'][i % 4],
  meals: i % 3 === 0 ? ['Breakfast', 'Lunch'] : i % 2 === 0 ? ['All meals'] : [],
  notes: i % 2 === 0 ? 'Early start required' : null,
  created_at: new Date(Date.now() - i * 86_400_000).toISOString(),
  yacht_roles: {
    id: `role-${i}`,
    name: ['Deckhand', 'Stewardess', 'Engineer', 'Bosun', 'Chef', 'First Officer', 'Captain', 'ETO', 'Mate', 'Purser'][i],
    department: ['deck', 'interior', 'engineering', 'deck', 'galley', 'bridge', 'bridge', 'engineering', 'deck', 'interior'][i],
  },
  ports: {
    id: `port-${i}`,
    name: ['Port Vauban', 'Port Hercules', 'Marina Ibiza', 'Port de Palma', 'Yacht Haven Grande'][i % 5],
    cities: {
      name: ['Antibes', 'Monaco', 'Ibiza', 'Palma', 'St Thomas'][i % 5],
      regions: { name: ['Antibes', 'Monaco', 'Ibiza', 'Palma', 'Caribbean'][i % 5] },
    },
  },
  vessels: {
    name: ['Azzam', 'Eclipse', 'Dilbar', 'Al Said', 'Topaz', 'Serene', 'Lady Moura', 'Al Mirqab', 'Octopus', 'Rising Sun'][i],
    nda_flag: i === 3,
    vessel_type: i % 3 === 0 ? 'sail' : 'motor',
    loa_meters: 40 + i * 10,
    vessel_size_bands: { label: `${30 + i * 10}-${40 + i * 10}m` },
  },
  experience_brackets: { label: ['0-6 months', '6-12 months', '1-2 years', '2-5 years', '5+ years'][i % 5] },
  cert_names: i % 2 === 0 ? ['STCW', 'ENG1'] : i % 3 === 0 ? ['STCW'] : [],
  required_languages: i % 4 === 0 ? ['English', 'French'] : [],
  positions_available: i === 2 ? 3 : 1,
  permanent_opportunity: i % 5 === 0,
}));

export default function SwipeTestScreen() {
  const [cards, setCards] = useState(MOCK_CARDS);
  const [lastAction, setLastAction] = useState<string>('');

  const handleSwipeRight = useCallback((item: DayworkCardData) => {
    setCards((prev) => prev.filter((c) => c.id !== item.id));
    setLastAction(`Applied: ${item.yacht_roles?.name} on ${item.vessels?.name}`);
  }, []);

  const handleSwipeLeft = useCallback((item: DayworkCardData) => {
    setCards((prev) => prev.filter((c) => c.id !== item.id));
    setLastAction(`Passed: ${item.yacht_roles?.name}`);
  }, []);

  const handleCardPress = useCallback((item: DayworkCardData) => {
    Alert.alert('Job Details', `${item.yacht_roles?.name} - DW-${String(item.job_number).padStart(5, '0')}`);
  }, []);

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <View className="px-4 py-2">
        <Text className="text-lg font-bold">Swipe Test ({cards.length} cards)</Text>
        {lastAction ? (
          <Text className="text-sm text-gray-500">{lastAction}</Text>
        ) : (
          <Text className="text-sm text-gray-400">Swipe right to apply, left to pass</Text>
        )}
      </View>

      <View className="flex-1 px-4 pb-4">
        <SwipeCardStack
          items={cards}
          keyExtractor={(c) => c.id}
          renderCard={(c) => <DayworkJobCard card={c} />}
          onSwipeRight={handleSwipeRight}
          onSwipeLeft={handleSwipeLeft}
          onCardPress={handleCardPress}
          emptyComponent={
            <View className="flex-1 items-center justify-center">
              <Text className="text-lg text-gray-500">No more cards!</Text>
            </View>
          }
        />
      </View>
    </SafeAreaView>
  );
}
