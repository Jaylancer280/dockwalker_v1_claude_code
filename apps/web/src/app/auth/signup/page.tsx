'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AuthAmbientBackground } from '@/components/auth-ambient-background';

export default function SignUpPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  // Poll for confirmed session after signup success
  useEffect(() => {
    if (!success) return;

    const supabase = createClient();
    const interval = setInterval(async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        window.location.href = '/onboarding';
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [success]);

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

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
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    setSuccess(true);
    setLoading(false);
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
            <CardTitle className="text-base">Create an account</CardTitle>
            <CardDescription>Start finding or posting daywork</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSignUp} className="flex flex-col gap-4">
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
