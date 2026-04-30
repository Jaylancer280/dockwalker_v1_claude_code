'use client';

import { Suspense, useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ChevronLeft, Check, LifeBuoy } from 'lucide-react';
import { LoadingSpinner } from '@/components/loading-spinner';
import { Button } from '@/components/ui/button';
import { safeFetch } from '@/lib/safe-fetch';

interface BillingStatus {
  plan: string | null;
  status: string | null;
  current_hat: string | null;
}

interface TierConfig {
  planId: 'crew_pro' | 'employer_pro';
  proLabel: string;
  proPrice: string;
  freeFeatures: string[];
  proFeatures: string[];
}

const CREW_TIER: TierConfig = {
  planId: 'crew_pro',
  proLabel: 'Crew Pro',
  proPrice: '€4.99/month',
  freeFeatures: [
    '10 Docky questions/month',
    'General MCA guidance',
    '3 daywork + 1 permanent template',
    '1 reference per experience',
  ],
  proFeatures: [
    '500 Docky questions/month',
    'Personalised career advice — Docky reads your profile',
    'Get discovered by employers — appear in proactive search alongside applying directly',
    '5 daywork + 2 permanent templates',
    'Up to 3 references per experience',
  ],
};

const EMPLOYER_TIER: TierConfig = {
  planId: 'employer_pro',
  proLabel: 'Employer Pro',
  proPrice: '€14.99/month',
  freeFeatures: [
    '3 daywork + 1 permanent template',
    'Shortlist up to 3 candidates',
    'Reach out to references — 5 contacts per 30 days (10 pending)',
  ],
  proFeatures: [
    'Unlimited templates',
    'Shortlist up to 8 candidates',
    'Unlimited reference outreach',
  ],
};

export default function BillingPage() {
  return (
    <Suspense>
      <BillingContent />
    </Suspense>
  );
}

function BillingContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [billing, setBilling] = useState<BillingStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [redirecting, setRedirecting] = useState(false);
  const showSuccess = searchParams.get('success') === 'true';

  useEffect(() => {
    void (async () => {
      const result = await safeFetch<BillingStatus>('/api/billing/status');
      if (result.ok) {
        setBilling(result.data);
      }
      setLoading(false);
    })();
  }, []);

  const hat = billing?.current_hat ?? 'crew';
  const tier = hat === 'crew' ? CREW_TIER : EMPLOYER_TIER;

  const isActive = billing?.status === 'active' || billing?.status === 'trialing';
  const isSubscribedToTier = isActive && billing?.plan === tier.planId;
  const isSubscribedToOther =
    isActive && billing?.plan && billing.plan !== tier.planId && billing.plan !== 'free';

  async function handleSubscribe() {
    setRedirecting(true);
    const result = await safeFetch<{ url?: string }>('/api/billing/create-checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan: tier.planId }),
    });
    if (result.ok && result.data.url) {
      window.location.href = result.data.url;
      return;
    }
    setRedirecting(false);
  }

  async function handleManage() {
    setRedirecting(true);
    const result = await safeFetch<{ url?: string }>('/api/billing/create-portal', {
      method: 'POST',
    });
    if (result.ok && result.data.url) {
      window.location.href = result.data.url;
      return;
    }
    setRedirecting(false);
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center pb-[var(--nav-height)]">
        <LoadingSpinner size="md" />
      </main>
    );
  }

  return (
    <main className="flex min-h-svh flex-col pb-[var(--nav-height)]">
      <div className="sticky top-0 z-10 flex items-center gap-2 border-b border-border bg-background px-2 py-3">
        <button
          onClick={() => router.back()}
          className="rounded-full p-1 transition-colors hover:bg-accent"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <h1 className="text-lg font-semibold">Plans</h1>
      </div>

      <div className="page-width flex w-full flex-col gap-4 px-4 py-6">
        {showSuccess && (
          <div className="flex items-center gap-2 rounded-lg bg-green-500/10 px-4 py-3 text-sm text-green-700 dark:text-green-400">
            <Check className="h-4 w-4 shrink-0" />
            Subscription activated. Welcome to {tier.proLabel}!
          </div>
        )}

        {isSubscribedToOther && (
          <div className="rounded-lg bg-blue-500/10 px-4 py-3 text-sm text-blue-700 dark:text-blue-400">
            You have an active {billing?.plan === 'crew_pro' ? 'Crew Pro' : 'Employer Pro'}{' '}
            subscription. Switch plans via &ldquo;Manage subscription&rdquo; below.
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {/* Free plan */}
          <div className="rounded-xl border border-border bg-card p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Free</h2>
              {!isSubscribedToTier && (
                <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium">
                  Current plan
                </span>
              )}
            </div>
            <ul className="flex flex-col gap-2">
              {tier.freeFeatures.map((f) => (
                <li key={f} className="flex items-center gap-2 text-sm text-muted-foreground">
                  <LifeBuoy className="h-3.5 w-3.5 shrink-0" />
                  {f}
                </li>
              ))}
            </ul>
          </div>

          {/* Pro plan */}
          <div className="rounded-xl border-2 border-primary bg-card p-5">
            <div className="mb-1 flex items-center justify-between">
              <h2 className="text-lg font-semibold">{tier.proLabel}</h2>
              {isSubscribedToTier && (
                <span className="rounded-full bg-primary px-2.5 py-0.5 text-xs font-medium text-primary-foreground">
                  Current plan
                </span>
              )}
            </div>
            <p className="mb-3 text-sm text-muted-foreground">{tier.proPrice}</p>
            <ul className="mb-5 flex flex-col gap-2">
              {tier.proFeatures.map((f) => (
                <li key={f} className="flex items-center gap-2 text-sm">
                  <Check className="h-3.5 w-3.5 shrink-0 text-primary" />
                  {f}
                </li>
              ))}
            </ul>
            {isSubscribedToTier ? (
              <Button
                className="w-full"
                variant="outline"
                onClick={handleManage}
                disabled={redirecting}
              >
                {redirecting ? 'Redirecting...' : 'Manage subscription'}
              </Button>
            ) : isSubscribedToOther ? (
              <Button
                className="w-full"
                variant="outline"
                onClick={handleManage}
                disabled={redirecting}
              >
                {redirecting ? 'Redirecting...' : 'Switch plan'}
              </Button>
            ) : (
              <Button className="w-full" onClick={handleSubscribe} disabled={redirecting}>
                {redirecting ? 'Redirecting...' : 'Subscribe'}
              </Button>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
