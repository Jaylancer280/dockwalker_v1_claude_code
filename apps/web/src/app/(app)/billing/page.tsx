'use client';

import { Suspense, useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ChevronLeft, Check, LifeBuoy } from 'lucide-react';
import { LoadingSpinner } from '@/components/loading-spinner';
import { Button } from '@/components/ui/button';
import { safeFetch } from '@/lib/safe-fetch';

interface SubscriptionEntry {
  status: string;
  current_period_end: string | null;
}

interface BillingStatus {
  subscriptions: {
    crew_pro: SubscriptionEntry | null;
    employer_pro: SubscriptionEntry | null;
  };
  current_hat: string | null;
}

interface TierConfig {
  planId: 'crew_pro' | 'employer_pro';
  proLabel: string;
  proPrice: string;
  proTagline: string;
  freeFeatures: string[];
  proFeatures: string[];
}

const CREW_TIER: TierConfig = {
  planId: 'crew_pro',
  proLabel: 'Crew Pro',
  proPrice: '€4.99/month',
  proTagline: 'Be findable by captains in the same port or city.',
  freeFeatures: [
    'Apply to every job — full feature parity',
    '10 Docky AI questions per month, general MCA guidance',
    '1 reference per experience visible on your profile',
  ],
  proFeatures: [
    'Show up in employers’ proactive crew search alongside your applications — 2x your shot at every posting',
    '500 Docky AI questions per month, personalised — reads your role, certs and sea-time',
    'Up to 3 references per experience visible on your profile',
    'Everything in Free',
  ],
};

const EMPLOYER_TIER: TierConfig = {
  planId: 'employer_pro',
  proLabel: 'Employer Pro',
  proPrice: '€14.99/month',
  proTagline: 'Hire faster: bigger shortlists, no template limits, unlimited reference checks.',
  freeFeatures: [
    'Post unlimited jobs — daywork and permanent',
    '3 daywork posting templates, 1 permanent',
    'Shortlist up to 3 candidates per posting',
    'Reference contacts — 5 accepted per 30 days (10 pending at a time)',
  ],
  proFeatures: [
    'Shortlist up to 8 candidates per posting — keep more strong applicants in play',
    'Unlimited daywork and permanent posting templates',
    'Unlimited reference outreach — no monthly or pending caps',
    'Everything in Free',
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

  // B-014: per-plan map. The page renders the hat-specific tier card
  // only — the OTHER hat's tier is surfaced as a hint footer below
  // (see "Looking for X Pro?" panel). Per the dual-sub model, a person
  // can independently hold both tiers, but each is subscribed/managed
  // from its own hat to keep the surface focused.
  const tierEntry = billing?.subscriptions?.[tier.planId] ?? null;
  const otherPlanId = tier.planId === 'crew_pro' ? 'employer_pro' : 'crew_pro';
  const otherEntry = billing?.subscriptions?.[otherPlanId] ?? null;

  const tierActive = tierEntry?.status === 'active' || tierEntry?.status === 'trialing';
  const otherActive = otherEntry?.status === 'active' || otherEntry?.status === 'trialing';

  const otherHatLabel = hat === 'crew' ? 'employer' : 'crew';
  const otherTierLabel = otherPlanId === 'crew_pro' ? 'Crew Pro' : 'Employer Pro';

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

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {/* Free plan */}
          <div className="rounded-xl border border-border bg-card p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Free</h2>
              {/* B-014: "Current plan" only fires when the user has NO
                  active pro tier of any kind. Previously this fell back
                  to "user is not subscribed to THIS hat's tier", which
                  mis-labelled Free as Current Plan when the user held the
                  other hat's pro. */}
              {!tierActive && !otherActive && (
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
              {tierActive && (
                <span className="rounded-full bg-primary px-2.5 py-0.5 text-xs font-medium text-primary-foreground">
                  Current plan
                </span>
              )}
            </div>
            <p className="text-sm text-muted-foreground">{tier.proPrice}</p>
            <p className="mb-3 mt-1 text-sm font-medium">{tier.proTagline}</p>
            <ul className="mb-5 flex flex-col gap-2">
              {tier.proFeatures.map((f) => (
                <li key={f} className="flex items-center gap-2 text-sm">
                  <Check className="h-3.5 w-3.5 shrink-0 text-primary" />
                  {f}
                </li>
              ))}
            </ul>
            {/* B-014: Subscribe / Manage are the only states. The old
                "Switch plan" branch (when the user held the other hat's
                pro) was dropped — with dual-sub support, you don't
                switch, you add. The OTHER hat's tier is surfaced as a
                hint footer below this card. */}
            {tierActive ? (
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

        {/* B-014: hint pointing to the other hat's tier. Two states:
            - other-active: "you also have X — switch to manage there"
            - other-not-active: "looking for X features? switch to subscribe"
            Always visible (otherwise users don't discover the parallel tier).
            Doesn't auto-switch hats — that's a separate UX gesture. */}
        <div className="mt-2 rounded-lg border border-border bg-[var(--surface)] px-4 py-3 text-sm text-muted-foreground">
          {otherActive ? (
            <>
              You also have <span className="font-medium text-foreground">{otherTierLabel}</span>{' '}
              active. Switch to your {otherHatLabel} hat to manage that subscription.
            </>
          ) : (
            <>
              Looking for <span className="font-medium text-foreground">{otherTierLabel}</span>{' '}
              features? Switch to your {otherHatLabel} hat to subscribe.
            </>
          )}
        </div>
      </div>
    </main>
  );
}
