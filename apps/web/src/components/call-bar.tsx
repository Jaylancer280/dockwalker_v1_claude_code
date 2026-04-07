'use client';

import { Phone, PhoneOff, Mic, MicOff } from 'lucide-react';
import type { CallState } from '@/hooks/use-voice-call';

interface CallBarProps {
  callState: CallState;
  remoteName: string;
  duration: number;
  isMuted: boolean;
  onToggleMute: () => void;
  onHangUp: () => void;
  onAccept?: () => void;
  onDecline?: () => void;
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function CallBar({
  callState,
  remoteName,
  duration,
  isMuted,
  onToggleMute,
  onHangUp,
  onAccept,
  onDecline,
}: CallBarProps) {
  if (callState === 'idle' || callState === 'ended') return null;

  const isRinging = callState === 'ringing';
  const isCalling = callState === 'calling';
  const isConnected = callState === 'connected';

  return (
    <div
      className={`fixed left-0 right-0 top-0 z-[65] flex items-center justify-between px-4 py-2.5 text-white ${
        isConnected
          ? 'bg-emerald-600'
          : isRinging
            ? 'bg-blue-600 animate-pulse'
            : 'bg-amber-600 animate-pulse'
      }`}
      style={{ paddingLeft: 'var(--sidebar-width, 0px)' }}
    >
      <div className="flex items-center gap-2 text-sm">
        <Phone className="h-4 w-4" />
        <span className="font-medium">
          {isRinging
            ? `Incoming call from ${remoteName}`
            : isCalling
              ? `Calling ${remoteName}...`
              : `${remoteName}`}
        </span>
        {isConnected && (
          <span className="font-mono text-xs opacity-80">{formatDuration(duration)}</span>
        )}
      </div>

      <div className="flex items-center gap-2">
        {isRinging && onAccept && (
          <button
            onClick={onAccept}
            className="rounded-full bg-emerald-500 p-2 transition-colors hover:bg-emerald-400"
            aria-label="Accept call"
          >
            <Phone className="h-4 w-4" />
          </button>
        )}

        {(isConnected || isCalling) && (
          <button
            onClick={onToggleMute}
            className="rounded-full bg-white/20 p-2 transition-colors hover:bg-white/30"
            aria-label={isMuted ? 'Unmute' : 'Mute'}
          >
            {isMuted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
          </button>
        )}

        <button
          onClick={isRinging && onDecline ? onDecline : onHangUp}
          className="rounded-full bg-red-500 p-2 transition-colors hover:bg-red-400"
          aria-label={isRinging ? 'Decline call' : 'End call'}
        >
          <PhoneOff className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
