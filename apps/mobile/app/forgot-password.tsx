import { useState } from 'react';
import { View, Text, TextInput, Pressable, Alert } from 'react-native';
import { Link } from 'expo-router';
import { supabase } from '@/lib/supabase';

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleReset() {
    if (!email) return;
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email);
    setLoading(false);
    if (error) {
      Alert.alert('Error', error.message);
    } else {
      setSent(true);
    }
  }

  if (sent) {
    return (
      <View className="flex-1 justify-center px-6 bg-white">
        <Text className="text-2xl font-bold text-center mb-4">Check your email</Text>
        <Text className="text-base text-gray-600 text-center mb-8">
          If an account exists for {email}, we sent a password reset link.
        </Text>
        <Link href="/sign-in" className="text-blue-600 text-center text-base">
          Back to sign in
        </Link>
      </View>
    );
  }

  return (
    <View className="flex-1 justify-center px-6 bg-white">
      <Text className="text-3xl font-bold text-center mb-8">Reset password</Text>

      <Text className="text-sm font-medium text-gray-700 mb-1">Email</Text>
      <TextInput
        className="border border-gray-300 rounded-lg px-4 py-3 mb-6 text-base"
        placeholder="you@example.com"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
        textContentType="emailAddress"
      />

      <Pressable
        className="bg-blue-600 rounded-lg py-3 items-center mb-4"
        onPress={handleReset}
        disabled={loading}
      >
        <Text className="text-white font-semibold text-base">
          {loading ? 'Sending...' : 'Send reset link'}
        </Text>
      </Pressable>

      <Link href="/sign-in" className="text-blue-600 text-center text-sm">
        Back to sign in
      </Link>
    </View>
  );
}
