import { useState } from 'react';
import { View, Text, TextInput, Pressable, Alert } from 'react-native';
import { Link } from 'expo-router';
import { useAuth } from '@/lib/auth-context';

export default function SignUpScreen() {
  const { signUp } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSignUp() {
    if (!email || !password) return;
    if (password.length < 8) {
      Alert.alert('Invalid password', 'Password must be at least 8 characters');
      return;
    }
    setLoading(true);
    const { error } = await signUp(email, password);
    setLoading(false);
    if (error) {
      Alert.alert('Sign up failed', error);
    } else {
      setSent(true);
    }
  }

  if (sent) {
    return (
      <View className="flex-1 justify-center px-6 bg-white">
        <Text className="text-2xl font-bold text-center mb-4">Check your email</Text>
        <Text className="text-base text-gray-600 text-center mb-8">
          We sent a confirmation link to {email}. Tap it to activate your account.
        </Text>
        <Link href="/sign-in" className="text-blue-600 text-center text-base">
          Back to sign in
        </Link>
      </View>
    );
  }

  return (
    <View className="flex-1 justify-center px-6 bg-white">
      <Text className="text-3xl font-bold text-center mb-8">Create account</Text>

      <Text className="text-sm font-medium text-gray-700 mb-1">Email</Text>
      <TextInput
        className="border border-gray-300 rounded-lg px-4 py-3 mb-4 text-base"
        placeholder="you@example.com"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
        textContentType="emailAddress"
      />

      <Text className="text-sm font-medium text-gray-700 mb-1">Password</Text>
      <TextInput
        className="border border-gray-300 rounded-lg px-4 py-3 mb-6 text-base"
        placeholder="8+ characters"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        textContentType="newPassword"
      />

      <Pressable
        className="bg-blue-600 rounded-lg py-3 items-center mb-4"
        onPress={handleSignUp}
        disabled={loading}
      >
        <Text className="text-white font-semibold text-base">
          {loading ? 'Creating account...' : 'Create account'}
        </Text>
      </Pressable>

      <Link href="/sign-in" className="text-blue-600 text-center text-sm">
        Already have an account? Sign in
      </Link>
    </View>
  );
}
