'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Phone, PhoneOff } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useVoiceCallContext } from '@/contexts/voice-call-context';
import { safeFetch } from '@/lib/safe-fetch';
import { useToast } from '@/hooks/use-toast';

interface EngagementInfo {
  id: string;
  otherName: string;
  permanent_posting_id: string | null;
}

interface IncomingCall {
  engagementId: string;
  callerName: string;
  sdp: RTCSessionDescriptionInit;
  from: string;
}

export function IncomingCallListener({ personId }: { personId: string }) {
  const router = useRouter();
  const { showError } = useToast();
  const { pendingOffer, setPendingOffer, activeCallEngagementId } = useVoiceCallContext();
  const [incomingCall, setIncomingCall] = useState<IncomingCall | null>(null);
  const channelsRef = useRef<ReturnType<ReturnType<typeof createClient>['channel']>[]>([]);
  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const engagementsRef = useRef<EngagementInfo[]>([]);

  // Fetch permanent engagements on mount
  useEffect(() => {
    async function loadEngagements() {
      const result = await safeFetch<{
        engagements?: {
          id: string;
          other_name: string;
          permanent_posting_id: string | null;
          status: string;
        }[];
      }>('/api/messages');
      if (!result.ok) return;

      const permanentActive = (result.data.engagements ?? []).filter(
        (e) => e.permanent_posting_id && e.status === 'active',
      );
      engagementsRef.current = permanentActive.map((e) => ({
        id: e.id,
        otherName: e.other_name,
        permanent_posting_id: e.permanent_posting_id,
      }));

      // Subscribe to broadcast channels for each engagement
      const supabase = createClient();
      for (const eng of engagementsRef.current) {
        const channel = supabase.channel(`call:${eng.id}`, {
          config: { broadcast: { self: false } },
        });

        channel.on('broadcast', { event: 'signal' }, ({ payload }) => {
          if (!payload || payload.from === personId) return;

          if (payload.action === 'offer') {
            // Check if already on a call
            if (activeCallEngagementId) {
              // Send busy signal
              channel.send({
                type: 'broadcast',
                event: 'signal',
                payload: { action: 'busy', from: personId },
              });
              return;
            }

            setIncomingCall({
              engagementId: eng.id,
              callerName: eng.otherName,
              sdp: payload.sdp,
              from: payload.from,
            });

            // Auto-dismiss after 45s
            if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
            dismissTimerRef.current = setTimeout(() => {
              setIncomingCall(null);
            }, 45_000);
          }

          if (payload.action === 'hangup' || payload.action === 'decline') {
            // Caller hung up or declined while we're showing the overlay
            setIncomingCall((prev) => (prev?.engagementId === eng.id ? null : prev));
            // If we already set a pending offer for this engagement, clear it
            if (pendingOffer?.engagementId === eng.id) {
              setPendingOffer(null);
              showError('Call ended');
            }
          }
        });

        channel.subscribe();
        channelsRef.current.push(channel);
      }
    }

    loadEngagements();

    return () => {
      if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
      const supabase = createClient();
      for (const ch of channelsRef.current) {
        supabase.removeChannel(ch);
      }
      channelsRef.current = [];
    };
  }, [personId, activeCallEngagementId, pendingOffer, setPendingOffer, showError]);

  const handleAccept = useCallback(() => {
    if (!incomingCall) return;

    // Store offer in context so the chat page hook picks it up
    setPendingOffer({
      engagementId: incomingCall.engagementId,
      sdp: incomingCall.sdp,
      from: incomingCall.from,
    });

    setIncomingCall(null);
    if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);

    // Navigate to the chat page
    router.push(`/messages/${incomingCall.engagementId}`);
  }, [incomingCall, setPendingOffer, router]);

  const handleDecline = useCallback(() => {
    if (!incomingCall) return;

    // Send decline signal
    const supabase = createClient();
    const channel = supabase.channel(`call:${incomingCall.engagementId}`, {
      config: { broadcast: { self: false } },
    });
    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        channel.send({
          type: 'broadcast',
          event: 'signal',
          payload: { action: 'decline', from: personId },
        });
        setTimeout(() => supabase.removeChannel(channel), 500);
      }
    });

    setIncomingCall(null);
    if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
  }, [incomingCall, personId]);

  if (!incomingCall) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="mx-4 w-full max-w-sm rounded-2xl bg-[var(--card)] p-6 text-center shadow-xl">
        <div className="mb-4 flex justify-center">
          <div className="animate-pulse rounded-full bg-emerald-500/20 p-4">
            <Phone className="h-8 w-8 text-emerald-500" />
          </div>
        </div>
        <h2 className="mb-1 text-lg font-semibold">Incoming Call</h2>
        <p className="mb-6 text-sm text-muted-foreground">{incomingCall.callerName}</p>
        <div className="flex justify-center gap-4">
          <button
            onClick={handleDecline}
            className="flex h-14 w-14 items-center justify-center rounded-full bg-red-500 text-white shadow-lg transition-transform hover:scale-105"
            aria-label="Decline"
          >
            <PhoneOff className="h-6 w-6" />
          </button>
          <button
            onClick={handleAccept}
            className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500 text-white shadow-lg transition-transform hover:scale-105"
            aria-label="Accept"
          >
            <Phone className="h-6 w-6" />
          </button>
        </div>
      </div>
    </div>
  );
}
