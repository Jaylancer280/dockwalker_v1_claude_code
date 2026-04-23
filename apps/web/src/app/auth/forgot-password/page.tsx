'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AuthAmbientBackground } from '@/components/auth-ambient-background';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/auth/reset-password`,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    setSuccess(true);
    setLoading(false);
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
            <CardTitle className="text-base">Reset password</CardTitle>
            <CardDescription>
              {success
                ? 'Check your email for a reset link'
                : "Enter your email and we'll send you a reset link"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {success ? (
              <div className="flex flex-col gap-4 text-center">
                <p className="text-sm text-muted-foreground">
                  If an account exists for <strong>{email}</strong>, you&apos;ll receive an email
                  with a link to reset your password.
                </p>
                <Link
                  href="/auth/login"
                  className="text-sm font-medium text-primary underline-offset-4 hover:underline"
                >
                  Back to sign in
                </Link>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="crew@example.com"
                    data-testid="email-input"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                {error && <p className="text-sm text-destructive">{error}</p>}
                <Button type="submit" disabled={loading} className="w-full">
                  {loading ? 'Sending...' : 'Send reset link'}
                </Button>
                <div className="text-center">
                  <Link
                    href="/auth/login"
                    className="text-sm text-muted-foreground underline-offset-4 hover:underline"
                  >
                    Back to sign in
                  </Link>
                </div>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
