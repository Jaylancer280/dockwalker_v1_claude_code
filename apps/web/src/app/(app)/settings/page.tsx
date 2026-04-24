'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { createClient } from '@/lib/supabase/client';
import { safeFetch } from '@/lib/safe-fetch';
import type { DistanceUnit, CurrencyCode } from '@dockwalker/shared';
import type { UserIdentity } from '@supabase/supabase-js';
import { AccountSection } from './_components/account-section';
import { NotificationsSection, type NotificationPrefs } from './_components/notifications-section';
import { TelegramSection } from './_components/telegram-section';
import { WhatsAppSection } from './_components/whatsapp-section';
import { AppearanceSection } from './_components/appearance-section';
import { DangerZoneSection } from './_components/danger-zone-section';

export default function SettingsPage() {
  const router = useRouter();
  const supabase = createClient();

  // User state
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [identities, setIdentities] = useState<UserIdentity[]>([]);

  // Notification preferences (server-side)
  const [notifPrefs, setNotifPrefs] = useState<NotificationPrefs>({
    email_enabled: true,
    push_jobs: true,
    push_applications: true,
    push_messages: true,
    push_reminders: true,
    whatsapp_enabled: false,
    telegram_enabled: false,
  });
  const [notifLoaded, setNotifLoaded] = useState(false);

  // Appearance (localStorage) — lazy initializers avoid setState-in-effect
  const [distanceUnit, setDistanceUnit] = useState<DistanceUnit>(() => {
    if (typeof window === 'undefined') return 'km';
    const saved = localStorage.getItem('dw-distance-unit');
    if (saved === 'km' || saved === 'mi' || saved === 'nm') return saved;
    return 'km';
  });
  const [currencyPref, setCurrencyPref] = useState<CurrencyCode>(() => {
    if (typeof window === 'undefined') return 'EUR';
    const saved = localStorage.getItem('dw-currency-pref');
    if (saved === 'EUR' || saved === 'USD' || saved === 'GBP' || saved === 'AED') return saved;
    return 'EUR';
  });

  const loadUser = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      setEmail(user.email ?? '');
      setIdentities(user.identities ?? []);
    }
    setLoading(false);
  }, [supabase.auth]);

  useEffect(() => {
    // Wrapped in async IIFE to satisfy react-hooks/set-state-in-effect:
    // loadUser and safeFetch both call setState asynchronously (after await),
    // which is fine, but the lint rule flags the direct call.
    void (async () => {
      await loadUser();
    })();

    void (async () => {
      const result = await safeFetch<{ preferences: NotificationPrefs }>('/api/preferences');
      if (result.ok && result.data.preferences) {
        setNotifPrefs(result.data.preferences);
      }
      setNotifLoaded(true);
    })();
  }, [loadUser]);

  function handleDistanceUnit(value: DistanceUnit) {
    setDistanceUnit(value);
    localStorage.setItem('dw-distance-unit', value);
  }

  function handleCurrencyPref(value: CurrencyCode) {
    setCurrencyPref(value);
    localStorage.setItem('dw-currency-pref', value);
  }

  function handleNotifToggle(field: keyof NotificationPrefs) {
    const prevValue = notifPrefs[field];
    const newValue = !prevValue;
    setNotifPrefs((prev) => ({ ...prev, [field]: newValue }));
    void (async () => {
      const res = await safeFetch<{ preferences: NotificationPrefs }>('/api/preferences', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: newValue }),
      });
      if (!res.ok) {
        // Revert optimistic update so the UI reflects reality
        setNotifPrefs((prev) => ({ ...prev, [field]: prevValue }));
        return;
      }
      // Replace local state with server truth — covers cases where the server
      // upsert set additional columns (e.g. webhook set telegram_enabled=true
      // after page load and we're syncing back up).
      if (res.data.preferences) setNotifPrefs(res.data.preferences);
    })();
  }

  const refreshNotifPrefs = useCallback(async () => {
    const res = await safeFetch<{ preferences: NotificationPrefs }>('/api/preferences');
    if (res.ok && res.data.preferences) setNotifPrefs(res.data.preferences);
  }, []);

  if (loading) {
    return (
      <main className="flex min-h-svh items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </main>
    );
  }

  return (
    <main className="flex min-h-svh flex-col bg-background">
      <header className="sticky top-0 z-10 border-b border-[var(--border)] bg-[var(--surface)] px-4 py-3">
        <div className="page-width flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => router.push('/profile')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-[24px] font-bold tracking-[-0.5px]">Settings</h1>
        </div>
      </header>

      <div className="page-width flex w-full flex-col gap-6 px-4 py-6">
        <AccountSection email={email} identities={identities} />

        <NotificationsSection
          notifPrefs={notifPrefs}
          notifLoaded={notifLoaded}
          onToggle={handleNotifToggle}
        />

        <TelegramSection
          telegramEnabled={notifPrefs.telegram_enabled}
          notifLoaded={notifLoaded}
          onToggleEnabled={() => handleNotifToggle('telegram_enabled')}
          onConnected={refreshNotifPrefs}
        />

        <WhatsAppSection
          whatsappEnabled={notifPrefs.whatsapp_enabled}
          notifLoaded={notifLoaded}
          onToggleEnabled={() => handleNotifToggle('whatsapp_enabled')}
        />

        <AppearanceSection
          distanceUnit={distanceUnit}
          onDistanceUnitChange={handleDistanceUnit}
          currencyPref={currencyPref}
          onCurrencyPrefChange={handleCurrencyPref}
        />

        <DangerZoneSection />
      </div>
    </main>
  );
}
