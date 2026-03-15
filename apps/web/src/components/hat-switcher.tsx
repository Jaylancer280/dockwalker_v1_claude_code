'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ArrowRightLeft } from 'lucide-react';

interface HatSwitcherProps {
  currentHat: string;
  identityType: string;
}

export function HatSwitcher({ currentHat, identityType }: HatSwitcherProps) {
  const [switching, setSwitching] = useState(false);

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
    const res = await fetch('/api/hat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hat: otherHat }),
    });
    if (res.ok) {
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
      className="gap-1.5 text-xs capitalize"
    >
      <ArrowRightLeft className="h-3 w-3" />
      {switching ? 'Switching...' : currentHat}
    </Button>
  );
}
