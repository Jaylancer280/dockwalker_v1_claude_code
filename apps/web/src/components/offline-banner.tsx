'use client';

import { useNetworkStatus } from '@/hooks/use-network-status';
import { WifiOff } from 'lucide-react';

export function OfflineBanner() {
  const { isOnline } = useNetworkStatus();

  if (isOnline) return null;

  return (
    <div className="bg-warning text-warning-foreground flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium">
      <WifiOff className="h-4 w-4" />
      You&apos;re offline — actions will fail until connection returns
    </div>
  );
}
