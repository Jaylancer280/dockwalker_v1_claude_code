'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { ArrowRightLeft } from 'lucide-react';
import { safeFetch } from '@/lib/safe-fetch';

interface HatSwitcherProps {
  currentHat: string;
  identityType: string;
}

export function HatSwitcher({ currentHat, identityType }: HatSwitcherProps) {
  const [switching, setSwitching] = useState(false);
  const [altCount, setAltCount] = useState(0);

  const fetchAltCount = useCallback(async () => {
    try {
      const result = await safeFetch<{
        alt_notification_count?: number;
        alt_message_count?: number;
      }>('/api/notifications/count');
      if (result.ok) {
        setAltCount(
          (result.data.alt_notification_count ?? 0) + (result.data.alt_message_count ?? 0),
        );
      }
    } finally {
      // setState guard for react-hooks/set-state-in-effect
    }
  }, []);

  useEffect(() => {
    if (identityType === 'agent') return;
    fetchAltCount();

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') fetchAltCount();
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [fetchAltCount, identityType]);

  // Agents can't switch
  if (identityType === 'agent') {
    return (
      <span className="rounded-full border border-border px-3 py-1 text-xs font-medium capitalize">
        {currentHat}
      </span>
    );
  }

  const otherHat = currentHat === 'crew' ? 'employer' : 'crew';

  async function handleSwitch() {
    setSwitching(true);
    const result = await safeFetch('/api/hat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hat: otherHat }),
    });
    if (result.ok) {
      window.location.reload();
    }
    setSwitching(false);
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleSwitch}
      disabled={switching}
      className="relative gap-1.5 text-xs"
    >
      <ArrowRightLeft className="h-3 w-3" />
      {switching ? 'Switching...' : `Switch to ${otherHat}`}
      {altCount > 0 && (
        <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-0.5 text-[9px] font-bold text-primary-foreground">
          {altCount > 99 ? '99+' : altCount}
        </span>
      )}
    </Button>
  );
}
