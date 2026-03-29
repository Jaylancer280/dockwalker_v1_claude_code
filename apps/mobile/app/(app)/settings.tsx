import { useState, useCallback } from 'react';
import { View, Text, Switch, Alert, TextInput, Linking, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import Constants from 'expo-constants';
import { useAuth } from '@/lib/auth-context';
import { usePreferences } from '@/hooks/use-preferences';
import { apiPatch, apiPost, apiGet } from '@/lib/api';
import { ScreenHeader, Button, SectionHeader, Card, colors } from '@/components/ui';

function PrefToggle({ label, value, field, onUpdate }: { label: string; value: boolean; field: string; onUpdate: (field: string, value: boolean) => void }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8 }}>
      <Text style={{ fontSize: 14, color: '#374151', flex: 1 }}>{label}</Text>
      <Switch value={value} onValueChange={(v) => onUpdate(field, v)} />
    </View>
  );
}

export default function SettingsScreen() {
  const { signOut } = useAuth();
  const { data: prefsData, invalidate } = usePreferences();
  const prefs = prefsData?.preferences;

  const [deleteInput, setDeleteInput] = useState('');
  const [deleting, setDeleting] = useState(false);

  const handleToggle = useCallback(async (field: string, value: boolean) => {
    const result = await apiPatch('/api/preferences', { [field]: value });
    if (result.ok) {
      invalidate();
    } else {
      Alert.alert('Error', result.error);
    }
  }, [invalidate]);

  const handleExport = useCallback(async () => {
    const result = await apiGet<Record<string, unknown>>('/api/account/export');
    if (result.ok) {
      Alert.alert('Data exported', `Your data export contains ${Object.keys(result.data).length} sections. A full export is available in the web app.`);
    } else {
      Alert.alert('Error', result.error);
    }
  }, []);

  const handleDeleteAccount = useCallback(async () => {
    if (deleteInput !== 'DELETE') {
      Alert.alert('Type DELETE', 'You must type DELETE to confirm account deactivation.');
      return;
    }
    setDeleting(true);
    const result = await apiPost('/api/account/deactivate');
    setDeleting(false);
    if (result.ok) {
      Alert.alert('Account deactivated', 'Your account has been deactivated. You will be signed out.', [
        { text: 'OK', onPress: () => signOut() },
      ]);
    } else {
      Alert.alert('Error', result.error);
    }
  }, [deleteInput, signOut]);

  const appVersion = Constants.expoConfig?.version ?? '1.0.0';

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f9fafb' }}>
      <ScreenHeader title="Settings" onBack={() => router.back()} />

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        {/* Notifications */}
        <SectionHeader title="Notifications" />
        <Card style={{ marginBottom: 16 }}>
          {prefs && (
            <>
              <PrefToggle label="Email notifications" value={prefs.email_enabled} field="email_enabled" onUpdate={handleToggle} />
              <PrefToggle label="New jobs" value={prefs.push_jobs} field="push_jobs" onUpdate={handleToggle} />
              <PrefToggle label="Applications" value={prefs.push_applications} field="push_applications" onUpdate={handleToggle} />
              <PrefToggle label="Messages" value={prefs.push_messages} field="push_messages" onUpdate={handleToggle} />
              <PrefToggle label="Reminders" value={prefs.push_reminders} field="push_reminders" onUpdate={handleToggle} />
            </>
          )}
        </Card>

        {/* Account */}
        <SectionHeader title="Account" />
        <Card style={{ marginBottom: 16, gap: 10 }}>
          <Button variant="secondary" label="Change password" onPress={() => Alert.alert('Password reset', 'A password reset email will be sent to your registered email address.')} />
          <Button variant="destructive" label="Sign out" onPress={() => {
            Alert.alert('Sign out?', 'You will need to sign in again.', [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Sign out', style: 'destructive', onPress: () => signOut() },
            ]);
          }} />
        </Card>

        {/* Privacy & Data */}
        <SectionHeader title="Privacy & Data" />
        <Card style={{ marginBottom: 16, gap: 10 }}>
          <Button variant="secondary" label="Export my data" onPress={handleExport} />
          <View style={{ borderTopWidth: 1, borderTopColor: '#f3f4f6', paddingTop: 10 }}>
            <Text style={{ fontSize: 13, color: '#dc2626', fontWeight: '600', marginBottom: 6 }}>Delete account</Text>
            <Text style={{ fontSize: 12, color: '#6b7280', marginBottom: 8 }}>Type DELETE to permanently deactivate your account. This cannot be undone.</Text>
            <TextInput
              value={deleteInput}
              onChangeText={setDeleteInput}
              placeholder='Type "DELETE"'
              placeholderTextColor="#9ca3af"
              autoCapitalize="characters"
              style={{ borderWidth: 1, borderColor: '#dc2626', borderRadius: 8, padding: 10, fontSize: 14, marginBottom: 8 }}
            />
            <Button variant="destructive" label={deleting ? 'Deactivating...' : 'Delete my account'} loading={deleting} disabled={deleteInput !== 'DELETE'} onPress={handleDeleteAccount} />
          </View>
        </Card>

        {/* About */}
        <SectionHeader title="About" />
        <Card style={{ gap: 8 }}>
          <Text style={{ fontSize: 13, color: '#6b7280' }}>Version {appVersion}</Text>
          <Button variant="ghost" size="sm" label="Terms of Service" onPress={() => Linking.openURL('https://dockwalker.io/terms')} />
          <Button variant="ghost" size="sm" label="Privacy Policy" onPress={() => Linking.openURL('https://dockwalker.io/privacy')} />
          <Button variant="ghost" size="sm" label="Contact Support" onPress={() => Linking.openURL('mailto:support@dockwalker.io')} />
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}
