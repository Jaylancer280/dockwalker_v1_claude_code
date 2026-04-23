'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';

interface GoogleAuthButtonProps {
  next?: string;
  label?: string;
  disabled?: boolean;
}

export function GoogleAuthButton({
  next = '/onboarding',
  label = 'Continue with Google',
  disabled,
}: GoogleAuthButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setError(null);
    setLoading(true);
    const supabase = createClient();
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });
    if (oauthError) {
      setError(oauthError.message);
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <button
        type="button"
        onClick={handleClick}
        disabled={disabled || loading}
        className="flex h-10 w-full items-center justify-center gap-2.5 rounded-md border border-[var(--border)] bg-[var(--card)] px-4 text-sm font-medium text-foreground transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-60"
        aria-label={label}
      >
        <GoogleLogo />
        {loading ? 'Connecting...' : label}
      </button>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

function GoogleLogo() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M23.52 12.27c0-.8-.07-1.56-.2-2.3H12v4.36h6.46a5.52 5.52 0 0 1-2.4 3.62v3h3.88c2.27-2.1 3.58-5.18 3.58-8.68z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.08 7.94-2.92l-3.88-3c-1.08.72-2.45 1.15-4.06 1.15-3.12 0-5.77-2.1-6.72-4.94H1.28v3.1A12 12 0 0 0 12 24z"
      />
      <path
        fill="#FBBC05"
        d="M5.28 14.29A7.2 7.2 0 0 1 4.9 12c0-.8.14-1.57.38-2.29V6.61H1.28A12 12 0 0 0 0 12c0 1.94.46 3.77 1.28 5.39l4-3.1z"
      />
      <path
        fill="#EA4335"
        d="M12 4.77c1.76 0 3.35.6 4.6 1.8l3.44-3.44C17.95 1.2 15.24 0 12 0A12 12 0 0 0 1.28 6.61l4 3.1C6.23 6.87 8.88 4.77 12 4.77z"
      />
    </svg>
  );
}
