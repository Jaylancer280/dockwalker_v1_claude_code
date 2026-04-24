'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Loader2, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { safeFetch } from '@/lib/safe-fetch';
import { useToast } from '@/hooks/use-toast';

interface TelegramStatus {
  connected: boolean;
}

interface TelegramInitResponse {
  deepLink: string;
  botUsername: string | null;
  expiresAt: string;
}

interface TelegramSectionProps {
  telegramEnabled: boolean;
  notifLoaded: boolean;
  onToggleEnabled: () => void;
}

const POLL_INTERVAL_MS = 3000;
const POLL_TIMEOUT_MS = 10 * 60 * 1000;

export function TelegramSection({
  telegramEnabled,
  notifLoaded,
  onToggleEnabled,
}: TelegramSectionProps) {
  const { showSuccess, showError } = useToast();
  const [status, setStatus] = useState<TelegramStatus | null>(null);
  const [statusLoading, setStatusLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [linkPending, setLinkPending] = useState<TelegramInitResponse | null>(null);
  const [showDisconnectConfirm, setShowDisconnectConfirm] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollStartRef = useRef<number>(0);

  const loadStatus = useCallback(async () => {
    const res = await safeFetch<TelegramStatus>('/api/notifications/telegram/status');
    if (res.ok) setStatus(res.data);
    setStatusLoading(false);
  }, []);

  useEffect(() => {
    void (async () => {
      await loadStatus();
    })();
  }, [loadStatus]);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  // Poll status while the deep-link panel is visible so the card flips to
  // "Connected" automatically once the user taps Start in Telegram.
  useEffect(() => {
    if (!linkPending) {
      stopPolling();
      return;
    }
    pollStartRef.current = Date.now();
    pollRef.current = setInterval(async () => {
      if (Date.now() - pollStartRef.current > POLL_TIMEOUT_MS) {
        stopPolling();
        setLinkPending(null);
        return;
      }
      const res = await safeFetch<TelegramStatus>('/api/notifications/telegram/status');
      if (res.ok && res.data.connected) {
        setStatus(res.data);
        setLinkPending(null);
        showSuccess('Telegram connected');
        stopPolling();
      }
    }, POLL_INTERVAL_MS);
    return stopPolling;
  }, [linkPending, stopPolling, showSuccess]);

  async function handleConnect() {
    setSubmitting(true);
    const res = await safeFetch<TelegramInitResponse>('/api/notifications/telegram/init', {
      method: 'POST',
    });
    setSubmitting(false);
    if (res.ok) {
      setLinkPending(res.data);
      // Open Telegram on the same tap — keeps desktop UX sane. Mobile intent
      // handlers pick this up and open the native app.
      window.open(res.data.deepLink, '_blank', 'noopener,noreferrer');
    } else {
      showError(res.error);
    }
  }

  async function handleDisconnect() {
    setSubmitting(true);
    const res = await safeFetch('/api/notifications/telegram', { method: 'DELETE' });
    setSubmitting(false);
    if (res.ok) {
      setStatus({ connected: false });
      setShowDisconnectConfirm(false);
      showSuccess('Telegram disconnected');
    } else {
      showError('Failed to disconnect');
    }
  }

  if (statusLoading) {
    return (
      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Telegram Notifications
        </h2>
        <div className="flex items-center justify-center rounded-[14px] border border-[var(--border)] bg-[var(--card)] p-6">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        </div>
      </section>
    );
  }

  return (
    <section>
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Telegram Notifications
      </h2>
      <div className="rounded-[14px] border border-[var(--border)] bg-[var(--card)]">
        {/* Connected state */}
        {status?.connected && !linkPending && (
          <>
            <div className="flex items-center gap-3 px-4 py-3">
              <Send className="h-5 w-5 text-sky-500" />
              <div className="flex-1">
                <p className="text-sm font-medium">Connected</p>
                <p className="text-xs text-muted-foreground">
                  DockWalker will send notifications to your linked Telegram chat.
                </p>
              </div>
            </div>
            <Separator />
            <div className="flex items-center justify-between px-4 py-3">
              <div>
                <p className="text-sm font-medium">Send via Telegram</p>
                <p className="text-xs text-muted-foreground">
                  Receive notifications on Telegram instead of push/email
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={telegramEnabled}
                disabled={!notifLoaded}
                onClick={onToggleEnabled}
                className={`relative h-6 w-11 rounded-full transition-colors ${telegramEnabled ? 'bg-[var(--accent)]' : 'bg-[var(--border)]'}`}
              >
                <span
                  className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${telegramEnabled ? 'translate-x-5' : 'translate-x-0'}`}
                />
              </button>
            </div>
            <Separator />
            <div className="px-4 py-3">
              {showDisconnectConfirm ? (
                <div className="flex items-center gap-2">
                  <p className="flex-1 text-xs text-muted-foreground">
                    Disconnect Telegram? You can always reconnect later.
                  </p>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={handleDisconnect}
                    disabled={submitting}
                  >
                    {submitting ? 'Disconnecting...' : 'Confirm'}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setShowDisconnectConfirm(false)}>
                    Cancel
                  </Button>
                </div>
              ) : (
                <button
                  onClick={() => setShowDisconnectConfirm(true)}
                  className="text-xs text-destructive hover:underline"
                >
                  Disconnect Telegram
                </button>
              )}
            </div>
          </>
        )}

        {/* Not connected — idle */}
        {!status?.connected && !linkPending && (
          <div className="flex flex-col gap-3 p-4">
            <div className="flex items-center gap-3">
              <Send className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Get notifications on Telegram</p>
                <p className="text-xs text-muted-foreground">
                  Instant delivery, free, no phone number needed — just a one-tap link
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleConnect}
              disabled={submitting}
              className="w-fit"
            >
              {submitting ? 'Opening...' : 'Connect Telegram'}
            </Button>
          </div>
        )}

        {/* Awaiting bot handshake */}
        {linkPending && (
          <div className="flex flex-col gap-3 p-4">
            <div className="flex items-center gap-3">
              <Loader2 className="h-5 w-5 animate-spin text-sky-500" />
              <div className="flex-1">
                <p className="text-sm font-medium">Waiting for you in Telegram…</p>
                <p className="text-xs text-muted-foreground">
                  Open the link and tap <b>Start</b> in Telegram. This page will update
                  automatically.
                </p>
              </div>
            </div>
            <a
              href={linkPending.deepLink}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-medium text-[var(--accent)] hover:underline"
            >
              Re-open Telegram link
            </a>
            <button
              onClick={() => setLinkPending(null)}
              className="w-fit text-xs text-muted-foreground hover:underline"
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
