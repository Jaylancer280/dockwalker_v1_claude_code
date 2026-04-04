'use client';

import { useState } from 'react';
import { Bell, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Capacitor } from '@capacitor/core';
import { registerPushNotifications } from '@/lib/push-notifications';

const PROMPTED_KEY = 'dw-push-prompted';
const TOKEN_KEY = 'dw_push_token';

function shouldShow(): boolean {
  if (typeof window === 'undefined') return false;
  if (!Capacitor.isNativePlatform()) return false;
  if (localStorage.getItem(PROMPTED_KEY)) return false;
  if (localStorage.getItem(TOKEN_KEY)) return false;
  return true;
}

export function PushPrompt() {
  const [visible, setVisible] = useState(shouldShow);

  if (!visible) return null;

  function dismiss() {
    localStorage.setItem(PROMPTED_KEY, '1');
    setVisible(false);
  }

  async function handleEnable() {
    try {
      await registerPushNotifications();
    } catch {
      // OS dialog denied — handled gracefully
    }
    dismiss();
  }

  return (
    <div className="mx-4 mb-4 rounded-xl border border-border bg-card p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <Bell className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
        <div className="flex-1">
          <p className="text-sm font-medium">Enable notifications</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Get notified instantly about new jobs, applications, and messages.
          </p>
          <div className="mt-3 flex gap-2">
            <Button size="sm" onClick={handleEnable}>
              Enable
            </Button>
            <Button size="sm" variant="ghost" onClick={dismiss}>
              Not now
            </Button>
          </div>
        </div>
        <button onClick={dismiss} aria-label="Dismiss" className="text-muted-foreground">
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
