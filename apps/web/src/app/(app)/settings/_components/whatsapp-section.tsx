'use client';

import { useState, useEffect, useCallback } from 'react';
import { Loader2, MessageCircle, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { safeFetch } from '@/lib/safe-fetch';
import { useToast } from '@/hooks/use-toast';

const COUNTRY_CODES = [
  { code: '+33', label: 'France (+33)' },
  { code: '+34', label: 'Spain (+34)' },
  { code: '+1', label: 'US (+1)' },
  { code: '+44', label: 'UK (+44)' },
  { code: '+971', label: 'UAE (+971)' },
  { code: '+90', label: 'Turkey (+90)' },
  { code: '+61', label: 'Australia (+61)' },
  { code: '+39', label: 'Italy (+39)' },
  { code: '+30', label: 'Greece (+30)' },
  { code: '+385', label: 'Croatia (+385)' },
  { code: '+382', label: 'Montenegro (+382)' },
];

interface WhatsAppStatus {
  connected: boolean;
  maskedPhone: string | null;
}

interface WhatsAppSectionProps {
  whatsappEnabled: boolean;
  notifLoaded: boolean;
  onToggleEnabled: () => void;
}

export function WhatsAppSection({
  whatsappEnabled,
  notifLoaded,
  onToggleEnabled,
}: WhatsAppSectionProps) {
  const { showSuccess, showError } = useToast();
  const [status, setStatus] = useState<WhatsAppStatus | null>(null);
  const [statusLoading, setStatusLoading] = useState(true);
  const [step, setStep] = useState<'idle' | 'phone' | 'otp'>('idle');
  const [countryCode, setCountryCode] = useState('+33');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [otpExpiresAt, setOtpExpiresAt] = useState<number | null>(null);
  const [showDisconnectConfirm, setShowDisconnectConfirm] = useState(false);

  const loadStatus = useCallback(async () => {
    const res = await safeFetch<WhatsAppStatus>('/api/notifications/whatsapp/status');
    if (res.ok) setStatus(res.data);
    setStatusLoading(false);
  }, []);

  useEffect(() => {
    void (async () => {
      await loadStatus();
    })();
  }, [loadStatus]);

  async function handleRegister() {
    const full = `${countryCode}${phoneNumber.replace(/\s/g, '')}`;
    if (!/^\+[1-9]\d{6,14}$/.test(full)) {
      showError('Enter a valid phone number');
      return;
    }
    setSubmitting(true);
    const res = await safeFetch<{ error?: string }>('/api/notifications/whatsapp/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phoneNumber: full }),
    });
    setSubmitting(false);
    if (res.ok) {
      setStep('otp');
      setOtpExpiresAt(Date.now() + 10 * 60 * 1000);
      showSuccess('Verification code sent via WhatsApp');
    } else {
      showError(res.error);
    }
  }

  async function handleVerify() {
    if (otpCode.length !== 6) {
      showError('Enter the 6-digit code');
      return;
    }
    setSubmitting(true);
    const res = await safeFetch<{ verified?: boolean; error?: string }>(
      '/api/notifications/whatsapp/verify',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: otpCode }),
      },
    );
    setSubmitting(false);
    if (res.ok && res.data.verified) {
      showSuccess('WhatsApp connected');
      setStep('idle');
      setPhoneNumber('');
      setOtpCode('');
      loadStatus();
    } else {
      showError(!res.ok ? res.error : 'Invalid or expired code');
    }
  }

  async function handleDisconnect() {
    setSubmitting(true);
    const res = await safeFetch('/api/notifications/whatsapp', { method: 'DELETE' });
    setSubmitting(false);
    if (res.ok) {
      showSuccess('WhatsApp disconnected');
      setStatus({ connected: false, maskedPhone: null });
      setShowDisconnectConfirm(false);
      setStep('idle');
    } else {
      showError('Failed to disconnect');
    }
  }

  if (statusLoading) {
    return (
      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          WhatsApp Notifications
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
        WhatsApp Notifications
      </h2>
      <div className="rounded-[14px] border border-[var(--border)] bg-[var(--card)]">
        {/* Connected state */}
        {status?.connected && step === 'idle' && (
          <>
            <div className="flex items-center gap-3 px-4 py-3">
              <MessageCircle className="h-5 w-5 text-emerald-500" />
              <div className="flex-1">
                <p className="text-sm font-medium">Connected</p>
                <p className="text-xs text-muted-foreground">{status.maskedPhone}</p>
              </div>
            </div>
            <Separator />
            <div className="flex items-center justify-between px-4 py-3">
              <div>
                <p className="text-sm font-medium">Send via WhatsApp</p>
                <p className="text-xs text-muted-foreground">
                  Receive notifications on WhatsApp instead of push/email
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={whatsappEnabled}
                disabled={!notifLoaded}
                onClick={onToggleEnabled}
                className={`relative h-6 w-11 rounded-full transition-colors ${whatsappEnabled ? 'bg-[var(--accent)]' : 'bg-[var(--border)]'}`}
              >
                <span
                  className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${whatsappEnabled ? 'translate-x-5' : 'translate-x-0'}`}
                />
              </button>
            </div>
            <Separator />
            <div className="px-4 py-3">
              {showDisconnectConfirm ? (
                <div className="flex items-center gap-2">
                  <p className="flex-1 text-xs text-muted-foreground">
                    Disconnect WhatsApp? Your phone number will be deleted.
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
                  Disconnect WhatsApp
                </button>
              )}
            </div>
          </>
        )}

        {/* Not connected — idle. WhatsApp delivery is still being built; the
            connect flow is hidden behind a disabled "Coming soon" affordance
            until the Meta Cloud API integration is live. */}
        {!status?.connected && step === 'idle' && (
          <div className="flex flex-col gap-3 p-4">
            <div className="flex items-center gap-3">
              <MessageCircle className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Get notifications on WhatsApp</p>
                <p className="text-xs text-muted-foreground">
                  Faster than email — notifications land in your WhatsApp instantly
                </p>
              </div>
            </div>
            <Button variant="outline" size="sm" disabled className="w-fit">
              Coming soon
            </Button>
          </div>
        )}

        {/* Phone number input */}
        {step === 'phone' && (
          <div className="flex flex-col gap-3 p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">Enter your phone number</p>
              <Button variant="ghost" size="icon" onClick={() => setStep('idle')}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex gap-2">
              <select
                value={countryCode}
                onChange={(e) => setCountryCode(e.target.value)}
                className="h-9 rounded-md border border-input bg-transparent px-2 text-sm"
              >
                {COUNTRY_CODES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.label}
                  </option>
                ))}
              </select>
              <Input
                type="tel"
                placeholder="612 345 678"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                className="flex-1"
              />
            </div>
            <Button onClick={handleRegister} disabled={submitting} size="sm" className="w-fit">
              {submitting ? 'Sending...' : 'Send verification code'}
            </Button>
          </div>
        )}

        {/* OTP verification */}
        {step === 'otp' && (
          <div className="flex flex-col gap-3 p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">Enter verification code</p>
              <Button variant="ghost" size="icon" onClick={() => setStep('phone')}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              We sent a 6-digit code to your WhatsApp.
              {otpExpiresAt && <OtpCountdown expiresAt={otpExpiresAt} />}
            </p>
            <Input
              type="text"
              inputMode="numeric"
              placeholder="000000"
              maxLength={6}
              value={otpCode}
              onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              className="w-32 text-center tracking-widest"
            />
            <div className="flex items-center gap-3">
              <Button onClick={handleVerify} disabled={submitting} size="sm">
                {submitting ? 'Verifying...' : 'Verify'}
              </Button>
              <button
                onClick={() => {
                  setStep('phone');
                  setOtpCode('');
                }}
                className="text-xs text-muted-foreground hover:underline"
              >
                Resend code
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function OtpCountdown({ expiresAt }: { expiresAt: number }) {
  const [remaining, setRemaining] = useState(() =>
    Math.max(0, Math.floor((expiresAt - Date.now()) / 1000)),
  );

  useEffect(() => {
    const interval = setInterval(() => {
      setRemaining(Math.max(0, Math.floor((expiresAt - Date.now()) / 1000)));
    }, 1000);
    return () => clearInterval(interval);
  }, [expiresAt]);

  if (remaining <= 0) return <span className="text-destructive"> Code expired</span>;
  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;
  return (
    <span>
      {' '}
      Expires in {mins}:{String(secs).padStart(2, '0')}
    </span>
  );
}
