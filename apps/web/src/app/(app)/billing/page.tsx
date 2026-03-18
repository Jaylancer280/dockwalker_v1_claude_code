'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ChevronLeft, Loader2, Check, LifeBuoy } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface SubscriptionStatus {
  plan: string | null;
  status: string | null;
}

const FREE_FEATURES = ['3 questions/month', 'General MCA guidance', 'Source citations'];
const PRO_FEATURES = ['Unlimited questions', 'Personalised career advice', 'Priority responses'];

export default function BillingPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [subscription, setSubscription] = useState<SubscriptionStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [redirecting, setRedirecting] = useState(false);
  const showSuccess = searchParams.get('success') === 'true';

  const isSubscribed =
    subscription?.plan &&
    subscription.plan !== 'free' &&
    (subscription.status === 'active' || subscription.status === 'trialing');

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/billing/status');
        const text = await res.text();
        const data = text ? JSON.parse(text) : {};
        if (res.ok) {
          setSubscription({ plan: data.plan ?? null, status: data.status ?? null });
        }
      } catch {
        // Show free plan on failure
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  async function handleSubscribe() {
    setRedirecting(true);
    try {
      const res = await fetch('/api/billing/create-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: 'crew_pro' }),
      });
      const text = await res.text();
      const data = text ? JSON.parse(text) : {};
      if (data.url) {
        window.location.href = data.url;
        return;
      }
    } catch {
      // Fall through
    }
    setRedirecting(false);
  }

  async function handleManage() {
    setRedirecting(true);
    try {
      const res = await fetch('/api/billing/create-portal', { method: 'POST' });
      const text = await res.text();
      const data = text ? JSON.parse(text) : {};
      if (data.url) {
        window.location.href = data.url;
        return;
      }
    } catch {
      // Fall through
    }
    setRedirecting(false);
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center pb-[var(--nav-height)]">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col pb-[var(--nav-height)]">
      {/* Header */}
      <div className="sticky top-0 z-40 flex items-center gap-2 border-b border-border bg-background px-2 py-3">
        <button
          onClick={() => router.back()}
          className="rounded-full p-1 transition-colors hover:bg-accent"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <h1 className="text-lg font-semibold">Plans</h1>
      </div>

      <div className="mx-auto flex w-full max-w-lg flex-col gap-4 px-4 py-6">
        {showSuccess && (
          <div className="flex items-center gap-2 rounded-lg bg-green-500/10 px-4 py-3 text-sm text-green-700 dark:text-green-400">
            <Check className="h-4 w-4 shrink-0" />
            Subscription activated. Welcome to Crew Pro!
          </div>
        )}

        {/* Free plan */}
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Free</h2>
            {!isSubscribed && (
              <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium">
                Current plan
              </span>
            )}
          </div>
          <ul className="flex flex-col gap-2">
            {FREE_FEATURES.map((f) => (
              <li key={f} className="flex items-center gap-2 text-sm text-muted-foreground">
                <LifeBuoy className="h-3.5 w-3.5 shrink-0" />
                {f}
              </li>
            ))}
          </ul>
        </div>

        {/* Crew Pro plan */}
        <div className="rounded-xl border-2 border-primary bg-card p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Crew Pro</h2>
            {isSubscribed && (
              <span className="rounded-full bg-primary px-2.5 py-0.5 text-xs font-medium text-primary-foreground">
                Current plan
              </span>
            )}
          </div>
          <ul className="mb-5 flex flex-col gap-2">
            {PRO_FEATURES.map((f) => (
              <li key={f} className="flex items-center gap-2 text-sm">
                <Check className="h-3.5 w-3.5 shrink-0 text-primary" />
                {f}
              </li>
            ))}
          </ul>
          {isSubscribed ? (
            <Button
              className="w-full"
              variant="outline"
              onClick={handleManage}
              disabled={redirecting}
            >
              {redirecting ? 'Redirecting...' : 'Manage subscription'}
            </Button>
          ) : (
            <Button className="w-full" onClick={handleSubscribe} disabled={redirecting}>
              {redirecting ? 'Redirecting...' : 'Subscribe'}
            </Button>
          )}
        </div>
      </div>
    </main>
  );
}
