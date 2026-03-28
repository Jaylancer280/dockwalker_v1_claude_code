import { useState } from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '@/lib/auth-context';

const STEPS = [
  'Welcome',
  'Identity',
  'Experience',
  'Profile',
  'Vessel Experience',
  'Hat Selection',
] as const;

function ProgressDots({ current, total }: { current: number; total: number }) {
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

export default function OnboardingScreen() {
  const { session } = useAuth();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);

  const apiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL;

  async function handleComplete() {
    if (!session || !apiBaseUrl) return;
    setLoading(true);

    try {
      const res = await fetch(`${apiBaseUrl}/api/onboarding`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          identityType: 'individual',
          displayName: session.user.email?.split('@')[0] ?? 'New User',
          currentHat: 'crew',
        }),
      });

      if (!res.ok) {
        const text = await res.text();
        const data = text ? JSON.parse(text) : {};
        throw new Error(data.error ?? 'Onboarding failed');
      }

      router.replace('/');
    } catch {
      // In Phase 1, onboarding is a shell — errors are expected
      // if the API isn't reachable. Route to main app anyway.
      router.replace('/');
    } finally {
      setLoading(false);
    }
  }

  function next() {
    if (step < STEPS.length - 1) {
      setStep(step + 1);
    } else {
      handleComplete();
    }
  }

  function back() {
    if (step > 0) setStep(step - 1);
  }

  return (
    <View className="flex-1 bg-white">
      <ProgressDots current={step} total={STEPS.length} />

      <ScrollView className="flex-1 px-6" contentContainerStyle={{ flexGrow: 1 }}>
        <View className="flex-1 items-center justify-center">
          <Text className="text-2xl font-bold mb-4">{STEPS[step]}</Text>
          <Text className="text-gray-500 text-center mb-8">
            Step {step + 1} of {STEPS.length}
          </Text>

          {step === 0 && (
            <Text className="text-base text-gray-600 text-center px-4">
              Welcome to DockWalker. Let&apos;s get you set up for the superyacht industry.
            </Text>
          )}

          {step === STEPS.length - 1 && (
            <Text className="text-base text-gray-600 text-center px-4">
              You&apos;re all set. Tap &quot;Complete&quot; to start finding work.
            </Text>
          )}
        </View>
      </ScrollView>

      <View className="flex-row px-6 pb-8 pt-4 gap-4">
        {step > 0 && (
          <Pressable
            className="flex-1 border border-gray-300 rounded-lg py-3 items-center"
            onPress={back}
          >
            <Text className="text-gray-700 font-semibold">Back</Text>
          </Pressable>
        )}
        <Pressable
          className="flex-1 bg-blue-600 rounded-lg py-3 items-center"
          onPress={next}
          disabled={loading}
        >
          <Text className="text-white font-semibold">
            {step === STEPS.length - 1
              ? loading
                ? 'Completing...'
                : 'Complete'
              : 'Next'}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
