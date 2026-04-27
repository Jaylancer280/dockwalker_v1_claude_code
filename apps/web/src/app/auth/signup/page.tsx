'use client';

import { useState, useEffect, Suspense } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AuthAmbientBackground } from '@/components/auth-ambient-background';
import { GoogleAuthButton } from '@/components/google-auth-button';

// Next.js requires components reading useSearchParams() to be wrapped in
// a Suspense boundary so the page can prerender. The default export wraps
// the inner component below.
export default function SignUpPage() {
  return (
    <Suspense fallback={null}>
      <SignUpPageInner />
    </Suspense>
  );
}

function SignUpPageInner() {
  const searchParams = useSearchParams();
  const isReferee = searchParams.get('referee') === '1';
  const next = searchParams.get('next');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [alreadyRegistered, setAlreadyRegistered] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  // Poll for confirmed session after signup success.
  // Lightweight referee path: route them back to /ref/[token] (via `next`) so
  // they can explicitly Accept the consent. Standard path goes to /onboarding.
  useEffect(() => {
    if (!success) return;

    const supabase = createClient();
    const interval = setInterval(async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        if (isReferee) {
          // Onboard the lightweight profile via onboard_person, then route to next.
          try {
            await supabase.rpc('onboard_person', {
              p_identity_type: 'crew',
              p_current_hat: 'crew',
              p_profile: {
                display_name: displayName || (user.email?.split('@')[0] ?? 'Referee'),
                referee_only: true,
              },
              p_person_id: user.id,
            });
          } catch {
            // If RPC fails (e.g. already onboarded), fall through to redirect.
          }
          window.location.href = next ?? '/messages';
        } else {
          window.location.href = '/onboarding';
        }
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [success, isReferee, next, displayName]);

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setAlreadyRegistered(false);

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    setLoading(true);

    const supabase = createClient();
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      if (error.message.toLowerCase().includes('already registered')) {
        setAlreadyRegistered(true);
      } else {
        setError(error.message);
      }
      setLoading(false);
      return;
    }

    // Supabase obfuscates existing confirmed users by returning empty `identities` with no error.
    if (data.user && (data.user.identities?.length ?? 0) === 0) {
      setAlreadyRegistered(true);
      setLoading(false);
      return;
    }

    setSuccess(true);
    setLoading(false);
  }

  if (alreadyRegistered) {
    return (
      <main className="flex min-h-svh flex-col items-center justify-center bg-background px-4 md:bg-[radial-gradient(ellipse_at_center,var(--accent-lo)_0%,transparent_70%)]">
        <AuthAmbientBackground />
        <div className="flex w-full max-w-sm flex-col items-center gap-6">
          <Image
            src="/images/brand/dw_app_icon_cropped.png"
            alt="DockWalker"
            width={64}
            height={64}
            className="rounded-2xl"
          />
          <Card className="w-full">
            <CardHeader>
              <CardTitle className="text-base">Account already exists</CardTitle>
              <CardDescription>
                <strong>{email}</strong> is already registered. Sign in instead, or reset your
                password if you&apos;ve forgotten it.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <Button asChild className="w-full">
                <Link href="/auth/login">Sign in</Link>
              </Button>
              <Button asChild variant="outline" className="w-full">
                <Link href="/auth/forgot-password">Reset password</Link>
              </Button>
              <button
                type="button"
                onClick={() => {
                  setAlreadyRegistered(false);
                  setEmail('');
                  setPassword('');
                  setConfirmPassword('');
                }}
                className="text-center text-sm text-muted-foreground underline-offset-4 hover:underline"
              >
                Use a different email
              </button>
            </CardContent>
          </Card>
        </div>
      </main>
    );
  }

  if (success) {
    return (
      <main className="flex min-h-svh flex-col items-center justify-center bg-background px-4 md:bg-[radial-gradient(ellipse_at_center,var(--accent-lo)_0%,transparent_70%)]">
        <AuthAmbientBackground />
        <div className="flex w-full max-w-sm flex-col items-center gap-6">
          <Image
            src="/images/brand/dw_app_icon_cropped.png"
            alt="DockWalker"
            width={64}
            height={64}
            className="rounded-2xl"
          />
          <Card className="w-full">
            <CardHeader>
              <CardTitle className="text-base">Check your email</CardTitle>
              <CardDescription>
                We&apos;ve sent a confirmation link to <strong>{email}</strong>. Click the link to
                complete your sign up.
              </CardDescription>
              <p className="mt-2 text-xs text-muted-foreground">
                This page will update automatically once you confirm.
              </p>
            </CardHeader>
          </Card>
          <Link
            href="/auth/login"
            className="text-sm font-medium text-primary underline-offset-4 hover:underline"
          >
            Back to sign in
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-svh flex-col items-center justify-center bg-background px-4 md:bg-[radial-gradient(ellipse_at_center,var(--accent-lo)_0%,transparent_70%)]">
      <AuthAmbientBackground />
      <div className="flex w-full max-w-sm flex-col items-center gap-6">
        <div className="flex flex-col items-center gap-2">
          <Image
            src="/images/brand/dw_app_icon_cropped.png"
            alt="DockWalker"
            width={64}
            height={64}
            className="rounded-2xl"
          />
          <h1 className="text-xl font-bold tracking-tight">DockWalker</h1>
        </div>

        <Card className="w-full">
          <CardHeader>
            <CardTitle className="text-base">
              {isReferee ? 'Sign up to give a reference' : 'Create an account'}
            </CardTitle>
            <CardDescription>
              {isReferee
                ? 'Lightweight signup — email + name only. You can complete a full crew profile later if you want.'
                : 'Start finding or posting daywork'}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <GoogleAuthButton next={isReferee && next ? next : '/onboarding'} />

            <div className="flex items-center gap-3 text-[11px] uppercase tracking-wider text-muted-foreground">
              <span className="h-px flex-1 bg-[var(--border)]" />
              <span>or sign up with email</span>
              <span className="h-px flex-1 bg-[var(--border)]" />
            </div>

            <form onSubmit={handleSignUp} className="flex flex-col gap-4">
              {isReferee && (
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="display-name">Your name</Label>
                  <Input
                    id="display-name"
                    type="text"
                    placeholder="Captain Smith"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    required
                    minLength={2}
                    maxLength={80}
                  />
                  {/* H-6 inline hint */}
                  <p className="text-xs text-muted-foreground">
                    By signing up you agree to DockWalker&apos;s Terms. Your basic profile (name +
                    the role you held) will be visible only on the references you accept. You can
                    complete a full crew profile later.
                  </p>
                </div>
              )}
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="crew@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="password">Password</Label>
                <PasswordInput
                  id="password"
                  placeholder="At least 8 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="confirm">Confirm password</Label>
                <PasswordInput
                  id="confirm"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                />
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button type="submit" disabled={loading} className="w-full">
                {loading ? 'Creating account...' : 'Create account'}
              </Button>
              <p className="text-center text-xs text-muted-foreground">
                By creating an account you agree to our{' '}
                <Link href="/terms" className="underline hover:text-foreground">
                  Terms of Service
                </Link>{' '}
                and{' '}
                <Link href="/privacy" className="underline hover:text-foreground">
                  Privacy Policy
                </Link>
                .
              </p>
            </form>
          </CardContent>
        </Card>

        <p className="text-sm text-muted-foreground">
          Already have an account?{' '}
          <Link
            href="/auth/login"
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            Sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
