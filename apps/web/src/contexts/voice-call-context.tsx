'use client';

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';

interface PendingOffer {
  engagementId: string;
  sdp: RTCSessionDescriptionInit;
  from: string;
}

interface VoiceCallContextValue {
  pendingOffer: PendingOffer | null;
  setPendingOffer: (offer: PendingOffer | null) => void;
  clearPendingOffer: () => void;
  activeCallEngagementId: string | null;
  setActiveCallEngagementId: (id: string | null) => void;
}

const VoiceCallContext = createContext<VoiceCallContextValue | null>(null);

export function VoiceCallProvider({ children }: { children: ReactNode }) {
  const [pendingOffer, setPendingOfferState] = useState<PendingOffer | null>(null);
  const [activeCallEngagementId, setActiveCallEngagementId] = useState<string | null>(null);

  const setPendingOffer = useCallback((offer: PendingOffer | null) => {
    setPendingOfferState(offer);
  }, []);

  const clearPendingOffer = useCallback(() => {
    setPendingOfferState(null);
  }, []);

  return (
    <VoiceCallContext.Provider
      value={{
        pendingOffer,
        setPendingOffer,
        clearPendingOffer,
        activeCallEngagementId,
        setActiveCallEngagementId,
      }}
    >
      {children}
    </VoiceCallContext.Provider>
  );
}

export function useVoiceCallContext() {
  const ctx = useContext(VoiceCallContext);
  if (!ctx) throw new Error('useVoiceCallContext must be used within VoiceCallProvider');
  return ctx;
}
