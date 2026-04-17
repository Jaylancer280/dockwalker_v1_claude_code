'use client';

import { Suspense, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';

export default function LoginPage() {
  return (
    <Suspense>
      <LoginContent />
    </Suspense>
  );
}

function LoginContent() {
  const [loading, setLoading] = useState(false);
  const searchParams = useSearchParams();
  const authError = searchParams.get('error');
  const loginError = searchParams.get('login_error');

  return (
    <main className="flex min-h-svh flex-col items-center justify-center bg-background px-4 py-12 md:bg-[radial-gradient(ellipse_at_center,var(--accent-lo)_0%,transparent_70%)]">
      <div className="flex w-full max-w-sm flex-col items-center gap-6">
        <div className="relative w-full pt-14">
          <div className="pointer-events-none absolute left-1/2 top-0 z-10 -translate-x-1/2">
            <Image
              src="/images/brand/dw_app_icon_cropped.png"
              alt="DockWalker"
              width={112}
              height={112}
              priority
              className="rounded-2xl shadow-lg ring-1 ring-black/5"
            />
          </div>

          <Card className="relative w-full pt-20 shadow-xl shadow-black/5">
            <CardContent className="flex flex-col gap-5">
              <div className="flex flex-col items-center gap-1.5 text-center">
                <h1 className="text-2xl font-bold tracking-tight">Welcome back</h1>
                <p className="text-sm text-muted-foreground">
                  Sign in to find work, fill roles, or check on your engagements.
                </p>
              </div>

              {authError === 'auth_failed' && (
                <p className="rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">
                  We couldn&apos;t verify your email automatically. Please sign in with your email
                  and password.
                </p>
              )}

              {/* Native form POST — server handles auth and redirects with
                  session cookies in the same HTTP response. No JavaScript
                  cookie handling. The browser follows the redirect and the
                  cookies are guaranteed to be set. */}
              <form
                method="POST"
                action="/api/auth/login"
                onSubmit={() => setLoading(true)}
                className="flex flex-col gap-4"
              >
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    placeholder="crew@example.com"
                    required
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-baseline justify-between">
                    <Label htmlFor="password">Password</Label>
                    <Link
                      href="/auth/forgot-password"
                      className="text-xs text-muted-foreground underline-offset-4 hover:underline"
                    >
                      Forgot password?
                    </Link>
                  </div>
                  <PasswordInput id="password" name="password" required />
                </div>
                {loginError && <p className="text-sm text-destructive">{loginError}</p>}
                <Button type="submit" disabled={loading} size="lg" className="w-full">
                  {loading ? 'Signing in...' : 'Sign in'}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>

        <p className="text-sm text-muted-foreground">
          Don&apos;t have an account?{' '}
          <Link
            href="/auth/signup"
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            Sign up
          </Link>
        </p>
      </div>
    </main>
  );
}
