'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useVoiceCallContext } from '@/contexts/voice-call-context';
import { safeFetch } from '@/lib/safe-fetch';

export type CallState = 'idle' | 'calling' | 'ringing' | 'connected' | 'ended';

interface UseVoiceCallOptions {
  engagementId: string;
  personId: string;
  remoteName: string;
}

interface UseVoiceCallReturn {
  callState: CallState;
  duration: number;
  isMuted: boolean;
  micDenied: boolean;
  endReason: string | null;
  startCall: () => Promise<void>;
  acceptCall: () => Promise<void>;
  declineCall: () => void;
  hangUp: () => void;
  toggleMute: () => void;
}

const CALL_TIMEOUT_MS = 45_000;
const ICE_DISCONNECT_TIMEOUT_MS = 10_000;
const ICE_TOTAL_TIMEOUT_MS = 30_000;

export function useVoiceCall({ engagementId, personId }: UseVoiceCallOptions): UseVoiceCallReturn {
  const [callState, setCallState] = useState<CallState>('idle');
  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [micDenied, setMicDenied] = useState(false);
  const [endReason, setEndReason] = useState<string | null>(null);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const channelRef = useRef<ReturnType<ReturnType<typeof createClient>['channel']> | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const durationTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const callTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const iceDisconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const iceTotalTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingCandidatesRef = useRef<RTCIceCandidateInit[]>([]);
  const remoteDescSetRef = useRef(false);
  const callStateRef = useRef<CallState>('idle');

  const { pendingOffer, clearPendingOffer, setActiveCallEngagementId } = useVoiceCallContext();

  // Keep ref in sync
  useEffect(() => {
    callStateRef.current = callState;
  }, [callState]);

  const cleanup = useCallback(() => {
    if (durationTimerRef.current) clearInterval(durationTimerRef.current);
    if (callTimeoutRef.current) clearTimeout(callTimeoutRef.current);
    if (iceDisconnectTimerRef.current) clearTimeout(iceDisconnectTimerRef.current);
    if (iceTotalTimerRef.current) clearTimeout(iceTotalTimerRef.current);
    durationTimerRef.current = null;
    callTimeoutRef.current = null;
    iceDisconnectTimerRef.current = null;
    iceTotalTimerRef.current = null;

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
    if (audioRef.current) {
      audioRef.current.srcObject = null;
      audioRef.current = null;
    }
    remoteDescSetRef.current = false;
    pendingCandidatesRef.current = [];
    setActiveCallEngagementId(null);
  }, [setActiveCallEngagementId]);

  const sendSignal = useCallback(
    (action: string, payload: Record<string, unknown> = {}) => {
      channelRef.current?.send({
        type: 'broadcast',
        event: 'signal',
        payload: { action, from: personId, ...payload },
      });
    },
    [personId],
  );

  const hangUp = useCallback(
    (reason?: string) => {
      sendSignal('hangup');
      cleanup();
      setEndReason(reason ?? null);
      setCallState('ended');
      if (channelRef.current) {
        const supabase = createClient();
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    },
    [sendSignal, cleanup],
  );

  const setupPeerConnection = useCallback(
    async (iceServers: RTCIceServer[]) => {
      const pc = new RTCPeerConnection({ iceServers });
      pcRef.current = pc;

      pc.onicecandidate = (e) => {
        if (e.candidate) {
          sendSignal('ice', { candidate: e.candidate.toJSON() });
        }
      };

      pc.ontrack = (e) => {
        if (!audioRef.current) {
          audioRef.current = document.createElement('audio');
          audioRef.current.autoplay = true;
        }
        audioRef.current.srcObject = e.streams[0];
        audioRef.current.play().catch(() => {});
      };

      pc.oniceconnectionstatechange = () => {
        if (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed') {
          if (iceDisconnectTimerRef.current) clearTimeout(iceDisconnectTimerRef.current);
          if (iceTotalTimerRef.current) clearTimeout(iceTotalTimerRef.current);
        }
        if (pc.iceConnectionState === 'disconnected') {
          iceDisconnectTimerRef.current = setTimeout(() => {
            pc.restartIce();
          }, ICE_DISCONNECT_TIMEOUT_MS);
          iceTotalTimerRef.current = setTimeout(() => {
            hangUp('Connection lost');
          }, ICE_TOTAL_TIMEOUT_MS);
        }
        if (pc.iceConnectionState === 'failed') {
          hangUp('Connection failed');
        }
      };

      return pc;
    },
    [sendSignal, hangUp],
  );

  const addIceCandidate = useCallback(async (candidate: RTCIceCandidateInit) => {
    if (remoteDescSetRef.current && pcRef.current) {
      await pcRef.current.addIceCandidate(new RTCIceCandidate(candidate));
    } else {
      pendingCandidatesRef.current.push(candidate);
    }
  }, []);

  const flushPendingCandidates = useCallback(async () => {
    const pc = pcRef.current;
    if (!pc) return;
    for (const c of pendingCandidatesRef.current) {
      await pc.addIceCandidate(new RTCIceCandidate(c));
    }
    pendingCandidatesRef.current = [];
  }, []);

  const subscribeToChannel = useCallback(() => {
    const supabase = createClient();
    const channel = supabase.channel(`call:${engagementId}`, {
      config: { broadcast: { self: false } },
    });

    channel.on('broadcast', { event: 'signal' }, async ({ payload }) => {
      if (!payload || payload.from === personId) return;
      const { action } = payload;

      if (action === 'answer' && pcRef.current) {
        await pcRef.current.setRemoteDescription(new RTCSessionDescription(payload.sdp));
        remoteDescSetRef.current = true;
        await flushPendingCandidates();
        if (callTimeoutRef.current) clearTimeout(callTimeoutRef.current);
        setCallState('connected');
        setDuration(0);
        durationTimerRef.current = setInterval(() => setDuration((d) => d + 1), 1000);
      }

      if (action === 'ice') {
        await addIceCandidate(payload.candidate);
      }

      if (action === 'hangup' || action === 'decline') {
        cleanup();
        setEndReason(action === 'decline' ? 'Call declined' : 'Call ended');
        setCallState('ended');
      }

      if (action === 'ringing') {
        // Callee acknowledged — update UI
      }

      if (action === 'busy') {
        cleanup();
        setEndReason('User is busy');
        setCallState('ended');
      }

      if (action === 'offer') {
        // Incoming call while already on this engagement page
        if (callStateRef.current !== 'idle') {
          sendSignal('busy');
          return;
        }
        // Store offer for acceptCall()
        pcRef.current?.close();
        const creds = await safeFetch<{ iceServers: RTCIceServer[] }>(
          '/api/calls/turn-credentials',
        );
        const servers = creds.ok
          ? creds.data.iceServers
          : [{ urls: 'stun:stun.l.google.com:19302' }];
        await setupPeerConnection(servers);
        await pcRef.current!.setRemoteDescription(new RTCSessionDescription(payload.sdp));
        remoteDescSetRef.current = true;
        await flushPendingCandidates();
        setCallState('ringing');
        sendSignal('ringing');
      }
    });

    channel.subscribe();
    channelRef.current = channel;
  }, [
    engagementId,
    personId,
    cleanup,
    addIceCandidate,
    flushPendingCandidates,
    setupPeerConnection,
    sendSignal,
  ]);

  const startCall = useCallback(async () => {
    setEndReason(null);
    setCallState('calling');
    setActiveCallEngagementId(engagementId);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      });
      streamRef.current = stream;
    } catch {
      setMicDenied(true);
      setCallState('idle');
      setActiveCallEngagementId(null);
      return;
    }

    const creds = await safeFetch<{ iceServers: RTCIceServer[] }>('/api/calls/turn-credentials');
    const servers = creds.ok ? creds.data.iceServers : [{ urls: 'stun:stun.l.google.com:19302' }];

    const pc = await setupPeerConnection(servers);
    streamRef.current!.getTracks().forEach((t) => pc.addTrack(t, streamRef.current!));

    subscribeToChannel();

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    sendSignal('offer', { sdp: offer });

    callTimeoutRef.current = setTimeout(() => {
      if (callStateRef.current === 'calling') {
        hangUp('No answer');
      }
    }, CALL_TIMEOUT_MS);
  }, [
    engagementId,
    setupPeerConnection,
    subscribeToChannel,
    sendSignal,
    hangUp,
    setActiveCallEngagementId,
  ]);

  const acceptCall = useCallback(async () => {
    setActiveCallEngagementId(engagementId);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      });
      streamRef.current = stream;
    } catch {
      setMicDenied(true);
      setCallState('idle');
      setActiveCallEngagementId(null);
      return;
    }

    const pc = pcRef.current;
    if (!pc) return;

    streamRef.current!.getTracks().forEach((t) => pc.addTrack(t, streamRef.current!));

    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    sendSignal('answer', { sdp: answer });

    setCallState('connected');
    setDuration(0);
    durationTimerRef.current = setInterval(() => setDuration((d) => d + 1), 1000);
  }, [engagementId, sendSignal, setActiveCallEngagementId]);

  const declineCall = useCallback(() => {
    sendSignal('decline');
    cleanup();
    setCallState('idle');
  }, [sendSignal, cleanup]);

  const toggleMute = useCallback(() => {
    if (streamRef.current) {
      const track = streamRef.current.getAudioTracks()[0];
      if (track) {
        track.enabled = !track.enabled;
        setIsMuted(!track.enabled);
      }
    }
  }, []);

  // Pick up pending offer from context (navigated from incoming call listener)
  useEffect(() => {
    if (pendingOffer && pendingOffer.engagementId === engagementId && callState === 'idle') {
      (async () => {
        const creds = await safeFetch<{ iceServers: RTCIceServer[] }>(
          '/api/calls/turn-credentials',
        );
        const servers = creds.ok
          ? creds.data.iceServers
          : [{ urls: 'stun:stun.l.google.com:19302' }];
        const pc = await setupPeerConnection(servers);
        subscribeToChannel();
        await pc.setRemoteDescription(new RTCSessionDescription(pendingOffer.sdp));
        remoteDescSetRef.current = true;
        await flushPendingCandidates();
        setCallState('ringing');
        clearPendingOffer();
      })();
    }
  }, [
    pendingOffer,
    engagementId,
    callState,
    setupPeerConnection,
    subscribeToChannel,
    flushPendingCandidates,
    clearPendingOffer,
  ]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (callStateRef.current !== 'idle' && callStateRef.current !== 'ended') {
        sendSignal('hangup');
      }
      cleanup();
      if (channelRef.current) {
        const supabase = createClient();
        supabase.removeChannel(channelRef.current);
      }
    };
  }, [cleanup, sendSignal]);

  return {
    callState,
    duration,
    isMuted,
    micDenied,
    endReason,
    startCall,
    acceptCall,
    declineCall,
    hangUp,
    toggleMute,
  };
}
